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

## 2026-09-14 — step/3 Polish

**Asked:** SSE realtime patches per `CLAUDE.md` step/3 — applied in place,
aggregates recomputed only for the changed node and its ancestors (O(depth)),
a ~1.5s fade on changed cells, a connection indicator with real (not
browser-default) exponential backoff, keyboard navigation across the table,
and tree expansion animated via a height transition that respects
`prefers-reduced-motion`. Scoped up front with the user: no server test
runner this step — `patchGenerator.mutateRandomNodes` stays pure and testable
later, but verification here is manual `curl -N` per `CLAUDE.md` §11's own
stated method for this route.

**Generated (Claude Code):** the server stream split (`streamHub.ts`,
`patchGenerator.ts`, `streamRoute.ts`), the zod patch contract
(`entities/org/patch.ts`), the O(depth) delta-walk (`entities/org/applyPatch.ts`
+ its property-based test comparing incremental results against
`aggregateOrgTree` from scratch across 5 seeds × 20 random patches — zero
mismatches), the generic SSE hook with injectable `EventSource` factory
(`api/sse/useSseConnection.ts` + tests using a fake factory and mocked
`Math.random`), the orchestration hook (`app/useOrgStream.ts`), the fade
highlight hook (`useFreshHighlight`), the roving-tabindex hook
(`useRovingIndex`, reused for both table headers and rows), the connection
indicator feature, the tree's two-layer height-transition wrapper, and this
session's docs (`adr/0002-sse-over-websocket.md`, and the step/3 additions to
`data-model.md`, `architecture.md`, `interview-prep.md`).

**Rewritten by hand:** nothing manually. Three issues were caught and fixed
by Claude during its own work, before reaching the user:
- A dependency-direction violation: `Freshness` was first defined inline in
  `app/useOrgStream.ts` and imported from there into `features/org-tree`'s
  `TreeNode.tsx`/`OrgTree.tsx` — `CLAUDE.md` §3 bans `features` importing
  from `app`. Caught by re-reading the diff against that rule before moving
  on; fixed by moving the type into `entities/org/patch.ts` instead (its
  shape mirrors `NodeChange`'s optional fields, so it belongs with the other
  patch-contract types) and re-exporting it from `entities/org/types.ts`.
- Two rounds of TypeScript errors in `useSseConnection.ts`: a direct
  `EventSourceLike` type for the real `EventSource` didn't line up with the
  DOM lib's actual handler signatures (`(ev: Event) => any` vs. a bare
  `() => void`), and widening the type to match broke `onmessage` instead
  (native `MessageEvent` isn't assignable from the hook's minimal `{data:
  string}` shape, by contravariance). `CLAUDE.md` §8 rules out `as unknown as`
  as an escape hatch, so the actual fix was a real adapter object
  (`defaultCreateEventSource`) that wraps the native `EventSource` and
  translates its full-fat handler calls into the hook's own narrow ones —
  not a cast, an object.
- A false alarm during manual browser verification: `read_console_messages`
  showed what looked like real crashes ("roots is not iterable",
  "Cannot read properties of undefined") that survived a page reload. Opening
  a brand-new tab on the same URL showed zero errors, proving the messages
  were stale entries left over from the session's many live HMR reloads
  (confirmed by the timestamps embedded in their stack traces), not a bug in
  the code that typecheck/lint/test/build had already confirmed clean.

**Non-obvious decisions worth knowing about:**
- `ConnectionIndicator` ended up mounted in `app/OrgDashboard.tsx`'s new
  `Toolbar` (next to `ViewSwitch`), not in `App.tsx`'s header as the approved
  plan said. Connection status is only meaningful once `useOrgStream` exists,
  which needs the loaded data (`roots`/`aggregates`/`byId`) as input — hoisting
  the indicator up to `App.tsx` would mean either a second SSE connection or
  extra prop plumbing the spec didn't ask for. Flagging this explicitly since
  it's a deviation from the plan the user approved, not something silently
  swapped in.
- `aggregates` is cloned per patch (new `Map`, touched rows replaced) while
  `OrgTreeNode` fields are mutated in place — an intentional asymmetry, not
  an inconsistency; see `docs/architecture.md`'s Realtime section for the
  reasoning and its `React.memo` caveat.
- The reconnect/backoff sequence and recovery were verified against a real
  killed server (`kill -9` on the port), not just unit tests. The first kill
  showed the indicator entering `reconnecting` with a live countdown and
  recovering to `Подключено` once the server restarted. A second kill (during
  a deliberate immediate-recovery follow-up test) took down the entire
  `concurrently`-wrapped dev server rather than just the server half — a
  quirk of that process-group/port-kill combination under the preview
  tooling, not a bug in the app — so that particular repeat run was abandoned
  in favour of the evidence already gathered from the first kill.
