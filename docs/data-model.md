# Data model

## Flat DTO and tree

```ts
type OrgNodeDto = {
  id: string
  name: string
  parentId: string | null
  headcount: number   // int, >= 0
  budget: number       // >= 0
  performance: number  // 0-100
  updatedAt: string     // ISO datetime
}

type OrgTreeNode = OrgNodeDto & { children: OrgTreeNode[] }
```

`buildOrgTree(flat: OrgNodeDto[]): { roots: OrgTreeNode[]; byId: Map<string, OrgTreeNode> }`
— a two-pass builder (`entities/org/buildTree.ts`). Rejects malformed data
instead of skipping it: a duplicate `id`, a `parentId` pointing nowhere, or a
cycle each throw `OrgTreeBuildError`. `byId` is the same `Map` the builder
already constructs internally in its first pass — returning it is what lets
`applyNodeChanges` (below) look up a mutated node in O(1) instead of walking
the tree to find it. (Step/3 change: step/2 returned bare `OrgTreeNode[]`.)

## Aggregate — sums, never averages

```ts
type Aggregate = {
  headcountTotal: number   // Σ headcount over the subtree, node included
  budgetTotal: number      // Σ budget
  weightedPerf: number     // Σ (headcount × performance)
}

avgPerformance = headcountTotal > 0 ? weightedPerf / headcountTotal : null
```

This is the load-bearing decision of the whole app (`CLAUDE.md` §5, see also
`docs/adr/0001-in-house-aggregation.md`). A weighted average cannot be
recomputed from children's averages without re-walking the subtree, but sums
add up — a parent's `Aggregate` is just the elementwise sum of its own values
and every child's already-computed `Aggregate`. That's what will let step/3's
per-patch update run in O(depth) (update the node, walk to the root applying
the delta) instead of O(subtree) (re-aggregate everything below the change).

**Null rule:** `headcountTotal === 0` → `avgPerformance` is `null`, rendered
as `—`. Never divide by zero, never render `NaN`. This can only happen for a
subtree where every node (including the root of that subtree) has zero
headcount.

## OrgAggregateRow

```ts
type OrgAncestor = { id: string; name: string }

type OrgAggregateRow = {
  id: string
  name: string
  parentId: string | null
  level: number                 // 1-based; roots are level 1
  ancestors: OrgAncestor[]       // root-first, excludes the node itself
  aggregate: Aggregate
  avgPerformance: number | null
}
```

`aggregateOrgTree(roots: OrgTreeNode[]): Map<string, OrgAggregateRow>` —
`entities/org/aggregate.ts`. One post-order DFS, run once after load and
memoised by the caller (`app/OrgDashboard.tsx`) — never recomputed inside a
component's render.

```
function visit(node, level, ancestors):
  own = { headcountTotal: node.headcount,
          budgetTotal: node.budget,
          weightedPerf: node.headcount * node.performance }

  childAncestors = ancestors + [{id: node.id, name: node.name}]
  aggregate = own + Σ visit(child, level + 1, childAncestors) for child in node.children

  rows[node.id] = { id, name, parentId, level, ancestors, aggregate,
                     avgPerformance: aggregate.headcountTotal > 0
                       ? aggregate.weightedPerf / aggregate.headcountTotal
                       : null }
  return aggregate

for root in roots: visit(root, level=1, ancestors=[])
```

`level` and `ancestors` fall out of the same traversal — there's no separate
pass for either.

## Patch contract and the incremental update (step/3)

```ts
type NodeChange = { id: string; headcount?: number; budget?: number; performance?: number; updatedAt: string }
type NodeUpdatedEvent = { type: 'node.updated'; revision: number; changes: NodeChange[] }
type HeartbeatEvent = { type: 'heartbeat'; revision: number }
type StreamEvent = NodeUpdatedEvent | HeartbeatEvent  // zod discriminated union on `type`
```

`GET /api/stream` (SSE) emits these; see `docs/adr/0002-sse-over-websocket.md`
for why SSE and why a hand-rolled reconnect instead of `EventSource`'s
built-in one. `revision` increases monotonically across *both* event types
from one shared counter (`server/src/stream/streamHub.ts`) — a gap on
reconnect (`revision` jumping by more than expected) means the client missed
patches and triggers a full refetch instead of an incremental apply.

`applyNodeChanges(nodesById, aggregates, changes): Map<string, OrgAggregateRow>`
(`entities/org/applyPatch.ts`, pure, no React) is the O(depth) update
`docs/adr/0001-in-house-aggregation.md` was designed to enable:

```
for each change:
  node = nodesById.get(change.id)
  row  = aggregates.get(change.id)          # already has this node's ancestors, root-first
  old  = node.headcount, node.budget, node.performance
  new  = change.headcount ?? old.headcount, etc.

  Δheadcount    = new.headcount - old.headcount
  Δbudget       = new.budget - old.budget
  ΔweightedPerf = new.headcount * new.performance - old.headcount * old.performance

  mutate node in place (headcount/budget/performance/updatedAt)   # per CLAUDE.md §7
  if all three deltas are 0: continue                              # no-op change, nothing to walk

  for id in [change.id, ...row.ancestors.map(a => a.id)]:          # self, then root-first ancestors
    current = result.get(id)                                       # read from the Map built THIS call
    aggregate = current.aggregate + (Δheadcount, Δbudget, ΔweightedPerf)
    result.set(id, { ...current, aggregate,
                      avgPerformance: aggregate.headcountTotal > 0
                        ? aggregate.weightedPerf / aggregate.headcountTotal : null })
```

Two details that make this correct rather than just fast:

- Deltas are read from **`result`** (the Map being built this call), not from
  the `aggregates` argument. A single patch batch can touch two nodes that
  share an ancestor; reading from `result` means the second node's delta adds
  onto the first node's already-applied delta on that shared ancestor instead
  of clobbering it.
- `OrgTreeNode` fields are mutated **in place**; `aggregates` is **not** —
  each visited row gets a new object in a cloned-at-the-top `Map`, untouched
  rows keep their original reference. See `docs/architecture.md`'s Realtime
  section for why these two data structures are treated asymmetrically.

Verified against `aggregateOrgTree` run from scratch after every step of a
random patch sequence (`applyPatch.test.ts`) — CLAUDE.md §11 calls this "the
strongest test in the project."

## Structured search filter (step/4)

```ts
type StructuredFilter = {
  nameContains?: string
  minHeadcount?: number; maxHeadcount?: number
  minBudget?: number; maxBudget?: number
  minPerformance?: number; maxPerformance?: number
  level?: number
}
```

Defined independently on server (`server/src/ai/filterSchema.ts`, validates
the AI's JSON output) and client (`entities/org/search.ts`, validates the
server's HTTP response) — same no-shared-package precedent as the patch
contract above. All fields are optional and AND-combined; `{}` matches
everything. See `docs/adr/0003-ai-search-fallback.md` for how a query
becomes one of these, and what happens when it can't.

`applyStructuredFilter(rows, filter): OrgAggregateRow[]`
(`entities/org/search.ts`) applies it — same same-reference-on-no-op trick as
`filterRowsByName`. One rule worth calling out: a `minPerformance` /
`maxPerformance` bound never matches a row whose `avgPerformance` is `null`
(a subtree with zero headcount has nothing to compare against a performance
bound — treated as "doesn't qualify," not "matches everything").

## Sorting

```ts
type SortColumn = 'name' | 'level' | 'headcount' | 'budget' | 'performance'
type SortDirection = 'asc' | 'desc'
```

`sortRows(rows, column, direction)` (`features/org-table/sortRows.ts`) is a
stable sort — ties keep their original relative order in both directions,
because direction is folded into the comparator itself (a sign multiplier)
rather than sorting ascending and reversing the array afterward.

**Null rule:** a row with `avgPerformance === null` always sorts after every
row that has a value, regardless of direction — reversing the direction never
moves a "no data" row to the top.

## Formatting

- `formatHeadcount(n)` → `"1 234 чел."`
- `formatBudget(n)` → `"12 345 678 руб."` (rounded to whole rubles)
- `formatPerformance(v: number | null)` → `"—"` for `null`, otherwise the
  rounded integer as a string

All three live in `shared/formatters/format.ts`, built on `Intl.NumberFormat`.
`Intl` emits different thousands-separator characters across runtimes
(non-breaking space vs. narrow no-break space) — tests normalize both to a
plain space before comparing rather than hardcoding one (`CLAUDE.md` §11).
