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
