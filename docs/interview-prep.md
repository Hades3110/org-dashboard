# Interview prep

Likely questions per area, with short answers. Extended after each stage —
see `CLAUDE.md` §14.

## step/2 — Core

**Q: Why store sums instead of averages for the rollups?**
A: A weighted average can't be recomputed from children's averages without
re-walking the whole subtree — you'd need their weights (headcounts) anyway,
which is exactly what the sums preserve. Storing `headcountTotal`,
`budgetTotal`, and `weightedPerf` lets a parent's aggregate be built from just
its own values plus each child's already-computed aggregate — an O(depth)
operation when only one node changes, instead of O(subtree). See ADR 0001.

**Q: Walk me through the double-click-reverses-sort trap and how it's avoided.**
A: A real double-click still dispatches two `click` events before `dblclick`
(browsers fire `click, click, dblclick`). If a single click toggled sort
direction, those two clicks would cancel each other out before the
double-click's own toggle landed — net effect: wrong or unpredictable
direction. The fix is to make `onClick` idempotent on the already-active
column (it only ever *switches to* a new column, ascending) and put the
actual direction-flip in `onDoubleClick` alone. Now two independent single
clicks are harmless no-ops, and a real double-click's two `click` events are
equally harmless before `dblclick` performs the one deliberate flip.

**Q: Why is the tree/table split view a CSS media query instead of a
`useMediaQuery` hook?**
A: Both panels stay mounted at all times either way — a JS hook would still
need to keep both mounted to avoid losing tree-expansion and table
sort/filter state on every resize or switch toggle, so it doesn't save
anything there. What it would cost: a `matchMedia` subscription with cleanup,
and jsdom-mocking to test it. A styled-components media query needs neither —
the trade-off is that the pixel breakpoint itself isn't covered by a unit
test (jsdom doesn't evaluate real media queries), so it's verified manually
in the browser instead.

**Q: The tree-reveal-on-row-click logic is split into two `useEffect`s. Why
not one?**
A: Expanding a collapsed ancestor (`setExpanded`) is asynchronous — the
target node's `<li>` doesn't exist in the DOM until the resulting re-render
commits. The first effect requests the expansion; the second effect (which
scrolls the node into view) depends on `isExpanded`'s identity rather than an
empty dependency array, because that identity is recreated exactly when the
expansion `Set` changes — it's a reliable signal that the DOM may have just
updated and it's safe to look up the ref again.

**Q: How does filtering avoid hiding a matched node's context?**
A: The name filter only matches a row's own name, so a deeply nested match's
ancestors might not individually appear in the filtered list. Rather than
force ancestors into the result set, each row's ancestor path (already
computed during aggregation, root-first) is rendered inline under the name —
so the hierarchy stays visible even when the table is narrowed down to a
single matching row.

## step/3 — Polish

**Q: Walk me through the O(depth) update when an SSE patch lands.**
A: Each `NodeChange` carries the node's new field values. `applyNodeChanges`
looks the node up by id (O(1), via `buildOrgTree`'s `byId` map), computes
three deltas against its *old* values (`Δheadcount`, `Δbudget`, and
`ΔweightedPerf = new(h×p) − old(h×p)`), mutates the node in place, then walks
`[nodeId, ...ancestors]` — already root-first from the initial aggregation —
adding the same three deltas to each visited row's `Aggregate` and
recomputing `avgPerformance` from the updated sums. No child is ever
re-visited, so the cost is proportional to the node's depth, not the size of
its subtree or the whole tree.

**Q: Why mutate the tree nodes in place but clone the aggregates Map?**
A: Nothing in the codebase keys off `OrgTreeNode` object identity today (zero
`React.memo` anywhere) — mutating in place is free and avoids rebuilding tree
structure every 4 seconds. `aggregates` needs a new top-level `Map` reference
regardless, since React only re-renders on a changed reference — given that's
unavoidable, only replacing the touched rows (not cloning all ~60) keeps
untouched references stable, which costs nothing today and is free insurance
if `React.memo` is ever added later. It's a documented trade-off, not an
inconsistency — see `docs/architecture.md`'s Realtime section for the caveat
about what would break if `React.memo(TreeNode)` were added without
revisiting it.

**Q: What does "not the built-in retry" actually mean in the code?**
A: On `EventSource.onerror`, most implementations would just let the browser
retry on its own schedule. Here, `onerror` explicitly calls `.close()` on the
dead `EventSource` first, then schedules a fresh one via `setTimeout` with a
delay this code computes itself (`min(30000, 1000 * 2^attempt)`, ±20% jitter
applied after the cap). That's what makes `retryDelayMs` a real number the
connection indicator can count down, instead of the browser's internal retry
being opaque to the app.

**Q: There's no replay buffer on the server — how does the client recover
from a missed patch after a reconnect?**
A: It doesn't try to recover the missed patch itself — it detects that one
was missed and refetches everything. Every event (mutation or heartbeat)
carries a shared, monotonically increasing `revision`. The client tracks the
last `revision` it saw; if the next one it receives isn't exactly one more,
it calls `refetch()` (a full reload, re-aggregated from scratch) instead of
trying to apply a patch against data it knows is stale. Heartbeats exist
specifically so `revision` keeps advancing even when nothing changes, or a
long quiet period would look identical to a missed patch.

**Q: Why does the tree's expand/collapse use two nested wrapper elements
instead of one `height: auto` transition?**
A: CSS can't transition to `height: auto` directly. The fix here is
`grid-template-rows` toggling between `0fr` and `1fr` on an outer container
(which *can* be transitioned), with an inner `overflow: hidden; min-height: 0`
box doing the actual clipping — a `0fr` track alone doesn't reliably clip
`fr`-sized intrinsic content in every browser, so the outer element only
drives the animated size while the inner element hides whatever overflows it
mid-transition.

**Q: `useRovingIndex` handles arrow keys and Home/End but not Enter — why?**
A: Arrow/Home/End movement is identical in both places it's used (table
headers, table rows), but Enter's behaviour isn't — on a header it triggers a
sort, on a row it selects. Baking Enter into the shared hook would mean
either a callback prop per caller (extra API surface for one key) or the hook
guessing at intent. Leaving it out keeps the hook's contract to "how focus
moves," and each call site's own `onKeyDown` handles what Enter *does* right
next to the rest of that call site's logic.
