# Architecture

## Layers

```
api            http client, ETag-aware cache layer, org-tree fetcher
  ↓
entities/org   zod schema, flat→tree builder, aggregation (pure TS, no React)
  ↓
features/      org-tree (tree view), org-table (analytical table)
  ↓
app            OrgDashboard — the only place that composes both features
```

Dependency direction is one-way: `features → entities → shared`, never the
reverse, and never feature → feature. `entities/org` stays pure TypeScript —
no React import — which is exactly why `aggregate.ts` and `buildTree.ts` are
unit-testable without a DOM.

## Data flow: fetch → build → aggregate

`app/OrgDashboard.tsx` is the single composition root and the only component
that calls `useCachedResource`. Everything downstream is prop-driven:

1. `useCachedResource(ORG_TREE_CACHE_KEY, fetchOrgTree, { staleTime: 5000 })`
   returns the flat `OrgNodeDto[]` (§6 of `CLAUDE.md`).
2. `buildOrgTree(nodes)` — a two-pass builder — turns the flat array into
   `OrgTreeNode[]` (roots with nested `children`). Memoised on `nodes`.
3. `aggregateOrgTree(roots)` — one post-order DFS — returns
   `Map<string, OrgAggregateRow>`, one entry per node, each carrying the
   node's own subtree `Aggregate` (sums), its 1-based `level`, and its
   root-first `ancestors` path. Memoised on `roots`.

Both memos key off the reference the cache layer hands back. A `304` response
keeps that reference identical (§6), so an unchanged poll skips `buildOrgTree`
*and* `aggregateOrgTree` entirely — not just one view's share of the work.

`OrgTree` and `OrgTable` never fetch, build, or aggregate themselves; they
receive `roots` / the row list as props and render.

## State ownership

| State | Owner | Why |
|---|---|---|
| Fetched data, loading/error/empty | `OrgDashboard` | Single fetch, shared by both views |
| `roots`, `aggregates` (memoised) | `OrgDashboard` | Computed once, consumed by both views |
| `selectedId`, `revealToken` | `OrgDashboard` | Cross-feature — a table row click must affect the tree |
| `viewMode` ('tree' \| 'table') | `OrgDashboard` | Drives which panel is visible below the split breakpoint |
| Expansion state, node DOM refs | `org-tree` (`useTreeExpansion`, `OrgTree`) | Nothing outside the tree needs it |
| Sort column/direction, filter text | `org-table` (`useSortState`, `OrgTable`) | Nothing outside the table needs it |

`org-table` never imports from `org-tree` or vice versa — the only thing that
imports both is `app/OrgDashboard.tsx`. This is why cross-feature state lives
in `app`, not in a `features/org-dashboard`: a feature-level composition would
make one feature import the other, which `CLAUDE.md` §3 forbids outright.

## Split view (tree/table switch, ≥1280px)

CSS-only: `theme.breakpoints.split` (`1280px`) drives a styled-components
media query in `OrgDashboard.styles.ts`. Both `OrgTree` and `OrgTable` stay
mounted in the DOM at all times — only their CSS `display` toggles between
`none` (inactive panel, narrow viewport) and `block`/`grid` (active panel, or
any width ≥1280px, where both are always shown). `ViewSwitch` itself is
hidden above the breakpoint, since it would otherwise imply a choice that no
longer exists.

Keeping both panels mounted, rather than conditionally rendering one, means
tree-expansion state and table sort/filter state survive both a window resize
and the user flipping the switch — with no `matchMedia` subscription/listener
to set up or clean up. The trade-off: `jsdom` doesn't evaluate real media
queries, so the pixel breakpoint itself is verified manually (browser resize),
not by a unit test — component tests assert the underlying prop wiring
instead.

## Reveal-in-tree (table → tree sync)

A table row click sets `selectedId` and increments `revealToken` in
`OrgDashboard`. `OrgTree` receives `selectedId`, `revealAncestorIds` (read
straight off `aggregates.get(selectedId).ancestors` — no second tree walk),
and `revealToken`, and runs two effects:

1. **Expand** — `expandAncestors(revealAncestorIds)` unions the ancestor ids
   into the expansion `Set` in one batched update (a no-op, same `Set`
   reference, if they're already expanded).
2. **Scroll** — looks up the selected node's `<li>` in a ref map
   (`registerNode`, populated via callback refs on every `TreeNode`) and calls
   `scrollIntoView`.

These are two separate effects, not one, because `setExpanded` in step 1 is
asynchronous: the target `<li>` only exists in the DOM once the resulting
re-render commits. Effect 2 depends on `isExpanded`'s identity rather than an
empty array — that identity is recreated exactly when the expansion `Set`
changes (see `useTreeExpansion`), so it's a reliable "the DOM may have just
changed, check again" trigger. A `useRef` guard (`lastRevealed`) stops it from
re-scrolling on unrelated re-renders once a given `(selectedId, revealToken)`
pair has already been handled.

## Realtime (step/3)

### Server: hub / generator / route

```
stream/streamHub.ts        module-level revision counter + Set<Response> of subscribers, broadcast()
stream/patchGenerator.ts   pure mutateRandomNodes(nodes, rng?) — no Express, no timers, no I/O
routes/streamRoute.ts      GET /api/stream — SSE headers, subscribe/unsubscribe, the two setIntervals
```

Split this way so `patchGenerator` stays unit-testable without spinning up a
server (it wasn't unit-tested this step — CLAUDE.md §11's stated method for
this route is manual `curl -N`, agreed with the user up front — but the split
means it *could* be, without touching the route). `streamHub` owns the one
`revision` sequence both event types share; `streamRoute` is the only file
that knows about HTTP at all. The mutation interval (4s) and heartbeat
interval (15s) both run unconditionally, independent of subscriber count, so
`/api/org-tree` and `/api/stream` never drift out of sync with each other.

### Client: connection / orchestration / algorithm

```
api/sse/useSseConnection.ts   generic SSE hook — reconnect/backoff, knows nothing about org data
app/useOrgStream.ts           orchestration — owns roots/aggregates state, gap check, freshness
entities/org/applyPatch.ts    pure O(depth) delta-walk — no React, no fetch, no SSE
```

`useSseConnection` is generic on purpose: it takes a `parse` function and
returns `{ status, lastMessage, retryDelayMs }`, with no knowledge that the
messages are org-tree patches. `useOrgStream` is where the org-specific
decisions live — gap detection, calling `refetch()` vs. `applyNodeChanges`,
building the `freshness` map for the fade highlight. `applyPatch.ts` stays
pure so it can be tested by comparing against `aggregateOrgTree` run from
scratch (see `docs/data-model.md`), independent of both React and SSE.

`useOrgStream` re-seeds its `roots`/`aggregates` state **during render**
(the React-documented "adjust state when a prop changes" pattern) whenever
`initialRoots`'s reference changes — i.e. whenever a real fetch or
revalidation lands — rather than in a `useEffect`. An effect would commit the
stale state first and re-seed one render later, opening a window where an
in-flight SSE patch could apply against data that's about to be thrown away;
adjusting during render skips that extra render and that race entirely.

### Mutate vs. clone — a stated asymmetry, not an oversight

`applyNodeChanges` mutates `OrgTreeNode` fields **in place**, but replaces
`aggregates` with a `new Map(prev)` where only the touched rows (the changed
node plus its ancestors) get new objects — untouched rows keep their original
reference.

This is deliberate, not inconsistent: nothing in the codebase today keys off
tree-node object identity (zero `React.memo` anywhere, confirmed by grep), so
mutating `OrgTreeNode` in place costs nothing and avoids rebuilding ~60 nodes'
worth of tree structure on every 4-second patch. `aggregates` needs a new
top-level `Map` reference regardless, to make React re-render — at that point,
giving untouched rows a stable reference is free insurance for a future
`React.memo`, so it costs nothing to do it that way instead of cloning every
row.

**Caveat, written down rather than hidden:** if `React.memo(TreeNode)` is ever
added without revisiting this, a mutated descendant under a memoized,
reference-stable ancestor could fail to re-render, since the ancestor's own
props (`node`, an `OrgTreeNode`) wouldn't have changed identity even though a
field on a node further down did. Anyone adding `React.memo` to `TreeNode`
needs to either key it off something that *does* change (e.g. include
`freshness`/`updatedAt` in the comparison) or switch the tree itself to
clone-on-write first.

### Fade highlight and reduced motion

`useFreshHighlight` mirrors `useDebouncedValue`'s shape: a `useEffect` keyed
on a `changedAt: number | null` timestamp (not a boolean), so a second change
to the same field within the ~1.5s window restarts the fade instead of
piling up timers — the timestamp changing is what clears the previous timer
before starting a new one. Freshness is tracked per field (`headcount`,
`budget`, `performance` each independently), because `NodeChange`'s fields
are all optional and only the cells that actually changed should highlight.

Two different `prefers-reduced-motion: reduce` treatments, for two different
reasons:

- **Tree height transition / toggle icon** (transform- and
  `grid-template-rows`-based): `transition: none` still leaves the correct
  end state visible, so reduced motion is just "cut the transition."
- **Fade highlight**: `transition: none` on a background-color transition
  that's supposed to *appear then disappear* would flash invisibly for a
  single frame — wrong. Reduced motion instead applies the same highlight
  colour with no transition, held for the same ~1.5s, so the change is still
  visibly flagged, just without the animated fade.

### Tree height transition mechanics

`TreeNode`'s children are now always mounted when `hasChildren` (previously
`hasChildren && expanded`), wrapped in two styled layers: an outer grid
container whose `grid-template-rows` toggles between `0fr` and `1fr`
(transitioned), and an inner `overflow: hidden; min-height: 0` box. The inner
box is required — a `0fr` track alone doesn't reliably clip `fr`-sized
intrinsic content by itself in every browser, so the actual clipping is done
by the inner box's `overflow: hidden`, with the outer grid only driving the
animated size.

### Roving tabindex, reused not duplicated

`shared/hooks/useRovingIndex.ts` is used twice — table headers (horizontal)
and table rows (vertical) — collapsing what would otherwise be one Tab stop
per header (5) plus one per row (~70) down to 2 total. Arrow keys move
`activeIndex` (clamped, not wrapped) and call `.focus()` synchronously inside
the keydown handler rather than via an effect, so focus movement isn't
delayed a render. `Enter` is deliberately left out of the hook: it means
"activate sort" on a header and "select this row" on a row — different
per-caller behaviour — so each call site handles `Enter` itself alongside the
shared hook's arrow/Home/End handling.

## Formatting and sorting contracts

See `docs/data-model.md` for the `Aggregate`/`OrgAggregateRow` shapes, the
`avgPerformance` null rule, and the sort/format contracts in detail.
