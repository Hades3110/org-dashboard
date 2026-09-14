# AI usage log

One entry per session: what was asked, what was generated, what was rewritten
by hand afterward and why. Kept honest and contemporaneous — see CLAUDE.md §12.

## 2026-09-14 — step/1 Foundation

**Asked:** scaffold the project per `CLAUDE.md` step/1 — Vite/React/TS client,
Express mock server, zod-validated flat org-tree API with debug scenarios, the
hand-written SWR cache layer (§6), and an interactive expand/collapse tree
with loading/error/empty states, zero inline CSS.

**Generated (Claude Code):** the full step/1 tree — root/client/server
workspaces and configs, the seeded data generator (~60 nodes, 4 levels), the
`/api/org-tree` route with `scenario`/`delay` query handling and ETag/304
support, `entities/org` (zod schema, two-pass tree builder with tests),
`api/cache/useCachedResource` (`useSyncExternalStore`-based SWR cache with
tests for fresh-serve, background revalidation, 304 identity/no-rerender, and
abort-is-not-an-error), the tree feature (`OrgTree`, `TreeNode`,
`useTreeExpansion`), theme/global styles, ESLint config, and this README/log.

**Rewritten by hand:** nothing manually — no human edits yet. Two bugs were
found and fixed by Claude during its own manual browser verification pass
(not caught by typecheck/lint/tests, since both were runtime/integration
issues):
- The server read `process.env.PORT`, which collided with a `PORT` env var
  the preview tooling injects for the client's own port — the server silently
  bound to the client's port instead of 3001. Fixed by renaming to
  `SERVER_PORT`.
- The cache layer only aborted an in-flight request when its last subscriber
  unsubscribed, to preserve sharing across concurrent subscribers — but React
  StrictMode's dev-only mount→unmount→remount could unsubscribe (aborting
  the fetch) and resubscribe before the abort finished propagating, so
  `ensureFresh` saw a stale non-null `inFlight` and never retried, leaving
  the UI stuck on the loading spinner. Fixed by retrying from the aborted
  request's `finally` when listeners are still present and no data has ever
  loaded.

**Non-obvious decisions worth knowing about:**
- "Second level expanded by default" was read as: levels 1–2 (company +
  divisions) start expanded, departments start collapsed, teams hidden until
  a department is expanded — the task text predates the 4-level model
  `CLAUDE.md` settled on (company → divisions → departments → teams).
- The cache layer's `isStale` flag is computed at render time from
  `updatedAt`, not stored in the `useSyncExternalStore` snapshot — so a 304
  response causes exactly zero re-renders, per §6's literal requirement,
  instead of one extra render to flip a stale flag.
- ETag/If-None-Match support was built into the server and cache layer now
  (not deferred to a later step) since it's the same cache-layer file §6
  already specifies for step/1; the debug `scenario=`/`delay=` paths
  deliberately bypass it so they're always fresh for manual testing.

## 2026-09-14 — step/2 Core

**Asked:** the analytical table view per `CLAUDE.md` step/2 — subtree
rollups (headcount-weighted average performance, stored as sums per §5),
tree/table switch with split view from 1280px, sort on any column with
double-click reversing direction, 250ms-debounced name filter, row click
syncing selection and scroll position back into the tree, `12 345 678 руб.`
budget formatting, and unit tests for the aggregation algorithm.

**Generated (Claude Code):** `entities/org/aggregate.ts` (the post-order DFS,
with tests including the weighted-vs-simple-mean sanity check and the
null-not-NaN guard), `shared/formatters/format.ts`,
`shared/hooks/useDebouncedValue.ts`, `shared/ui/PerformanceIndicator.tsx`
(extracted so `org-tree` and `org-table` don't duplicate the color-coded dot),
the full `features/org-table/` feature (`sortRows`, `filterRowsByName`,
`useSortState`, `OrgTable`, `TableRow`), the new `app/OrgDashboard.tsx`
composition root (fetch/build/aggregate moved out of `OrgTree`, plus
`selectedId`/`revealToken`/`viewMode` state), the reveal-in-tree ref-map and
two-effect mechanism in `OrgTree.tsx`, the `theme.breakpoints.split` token and
CSS-only split-view grid, and this session's docs
(`architecture.md`, `data-model.md`, `adr/0001-in-house-aggregation.md`,
`interview-prep.md`).

**Rewritten by hand:** nothing manually. One generated-then-fixed issue,
caught by lint rather than a human: the whitespace-normalizing regex in
`format.test.ts` was first written with literal non-breaking-space characters
pasted into the source instead of `\uXXXX` escapes (an artifact of how the
file-write tool interprets escape sequences in its input) — ESLint's
`no-irregular-whitespace` caught it immediately; fixed by building the
character class from `String.fromCharCode` instead of a regex literal, which
sidesteps the escaping question entirely.

**Non-obvious decisions worth knowing about:**
- Cross-feature state (`selectedId`, `revealToken`, `viewMode`) lives in
  `app/OrgDashboard.tsx`, not a `features/org-dashboard` — a feature-level
  composition would make `org-table` import `org-tree` (or vice versa), which
  §3 bans. `app` already imports features; this just moves the existing
  fetch/build split up one level and adds the shared state alongside it.
- The split-view breakpoint keeps both `OrgTree` and `OrgTable` mounted at
  all times (CSS `display` toggle only) rather than conditionally rendering
  one — the deciding factor was that tree-expansion and table sort/filter
  state would otherwise be lost on every resize or switch toggle.
- Sort direction reversal lives entirely in `onDoubleClick`, with `onClick`
  made idempotent on the active column, specifically to dodge the
  click-cancels-double-click trap `CLAUDE.md` §11 calls out by name.
- Verified the aggregation by hand against the seeded dataset via the raw
  API response (`curl .../api/org-tree`, summed headcount/budget/weighted
  performance with a one-off script) before trusting the table's numbers —
  852 чел. / 55 116 276 руб. / avg 65 for the root matched exactly.
