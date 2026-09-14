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

`buildOrgTree(flat: OrgNodeDto[]): OrgTreeNode[]` — a two-pass builder
(`entities/org/buildTree.ts`). Rejects malformed data instead of skipping it:
a duplicate `id`, a `parentId` pointing nowhere, or a cycle each throw
`OrgTreeBuildError`.

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

**Not yet built:** the O(depth) incremental update (apply an SSE patch to one
node, then walk to the root re-summing each ancestor's `Aggregate` from its
own values + its children's current aggregates) is step/3 scope. Today,
`aggregateOrgTree` is only ever called once per real data change (a fresh
fetch or a revalidation that wasn't a `304`) — there is no patch path yet.

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
