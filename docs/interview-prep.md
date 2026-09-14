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
