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

## 2026-09-14 — step/4 Production and AI search

**Asked:** the final milestone per `CLAUDE.md` step/13 — `docker compose up`
bringing up client and server behind Nginx (gzip, API proxying,
`proxy_buffering off` for the SSE route, key configured through `.env`), and
natural-language search returning a structured filter with a plain-text
fallback on error/timeout/invalid JSON, key never reaching the bundle.
Scoped up front with the user: Anthropic Claude API via a raw `fetch` (no new
SDK dependency), built without an API key in this environment (none was set)
— fully verified via the fallback path, real key to be added afterward.

**Generated (Claude Code):** the AI search feature end to end — server
(`ai/anthropicClient.ts`, `ai/filterSchema.ts`, `ai/parseFilterResponse.ts`,
`routes/aiSearchRoute.ts`) and client (`entities/org/search.ts` + tests,
`app/useAiSearch.ts` + tests with an injected fake `fetch` covering success,
non-2xx, invalid body, and a superseded-request race), the
`features/ai-search/AiSearchInput` presentational component, the
`OrgTable`/`OrgDashboard` rewiring to move filtering up to where the
AI/fallback decision happens; the full Docker/Nginx setup
(`docker-compose.yml`, both `Dockerfile`s, `nginx.conf`, `.env.example`,
`.dockerignore`); `docs/adr/0003-ai-search-fallback.md` and this session's
additions to `data-model.md`, `architecture.md`, `interview-prep.md`.

**Rewritten by hand:** nothing manually. One dependency-direction slip caught
and fixed before it landed: `AiSearchStatus` was first going to be defined
inline in `app/useAiSearch.ts` and imported from there into
`features/ai-search/AiSearchInput.tsx` — the same `features → app` mistake
self-caught in step/3 with `Freshness`. Fixed the same way: moved the type
into the feature (`features/ai-search/types.ts`) and had `app` import it from
there instead, which is the allowed direction.

**Initially abandoned, then fixed:** the README screenshot. Six attempts at
an automated headless-Chrome capture of the running app (`--headless=new`
and legacy `--headless`, fresh throwaway profiles, `--virtual-time-budget`,
`--run-all-compositor-stages-before-draw`, wall-clock timeouts up to 20s) all
hung indefinitely and never wrote a file — a control screenshot of a static
page (example.com) with the identical command succeeded in ~6s, isolating
the cause to this app specifically: the page holds an open SSE `EventSource`
connection, and Chrome's `--screenshot` flag appears to wait on network-idle
before capturing, which a permanently-open stream never reaches. This was
cut from the original step/4 handoff rather than left half-populated. In a
follow-up ask from the user, one more flag closed the gap: `--timeout=5000`
(headless Chrome's own hard cap on how long it waits before capturing
regardless of pending network activity) succeeded on the first retry —
`docs/screenshots/split-view.png`, embedded in the README, is a real capture
of the running dev server at 1600×1000 (wide enough to trigger the ≥1280px
split view), taken *after* the two user-reported bugs in the entry below
were fixed, so it also serves as visual proof they're gone.

**Non-obvious decisions worth knowing about:**
- The AI call is a background upgrade over an always-current instant
  plain-text filter, not a blocking request the input waits on — typing
  never stalls on network latency, and "fallback" has no separate visual
  state to get wrong, since it's just the AI upgrade never arriving.
- `server` is not published to the host in `docker-compose.yml` — only
  `client`'s nginx is. This isn't just topology tidiness: it's what makes
  "the API key never reaches the client bundle" true by construction rather
  than by discipline, since the key only ever exists in an environment the
  client build process never touches.
- `AI_SEARCH_MODEL`/`AI_SEARCH_TIMEOUT_MS` read from `process.env` with
  `|| undefined` / a truthy check rather than `??` — docker-compose passes an
  unset `.env` value through as an empty string, not as absent, and `??`
  wouldn't have caught that (`Number('')` is `0`, not `NaN`) — treating `''`
  the same as unset was necessary for `callAnthropic`'s own default
  parameters to actually kick in when nothing was configured.
- Confirmed the full stack in real Docker containers, not just reasoning
  about the Dockerfiles: `docker compose up --build`, then `curl` checks for
  gzip (`Content-Encoding` header on the JS bundle), the org-tree API
  proxying through, and — the one that actually mattered — live SSE frames
  arriving through nginx within seconds (`curl -N`), proving
  `proxy_buffering off` works rather than assuming the config was right.

## 2026-09-14 — step/4 follow-up: two user-reported bugs

**Asked:** two bugs the user found by hand right after step/4 landed, both
in the AI-search + realtime interaction that no automated test had covered.

**Bug 1 — split-view columns drift as the table's row count changes.**
Reported as: "when I search and there's no result, the table gets narrower
and the tree gets wider." Root cause: `Panel` (the actual CSS grid item in
`OrgDashboard.styles.ts`) had no `min-width` override, so its default
automatic minimum width came from its content's min-content size rather
than being 0 — with two `1fr` columns, whichever panel's content was
intrinsically wider (the table, with long row/breadcrumb text, when it had
many rows) pulled width away from the other, and the split visibly reflowed
every time the search's result count changed the table's own min-content.
Verified with the browser tool before and after: at a 1500px viewport, tree
and table measured 564px/864px before the fix (already unequal at rest, not
just when empty) and a stable 714px/714px after, in both the empty-result
and full-table states. Fix: `min-width: 0` on `Panel` — a single line,
letting each column size purely from its `1fr` share; `TableScroll`'s
existing `overflow-x: auto` still absorbs any content wider than that via
internal horizontal scroll.

**Bug 2 — clearing a search after live patches flashes many fields as
"just updated."** Reported as: "after I search then clear, a lot of fields
get marked as updated." Root cause: `useFreshHighlight` treated any non-null
`changedAt` as fresh on mount, regardless of age — and `useOrgStream`'s
`freshness` map is never pruned, so any node ever touched by an SSE patch
keeps a timestamp in it indefinitely. Filtering the table via AI search
unmounts the rows it hides (the first thing in this codebase to actually
unmount `TableRow`s rather than just reordering or CSS-hiding them); when
the search clears, those rows remount, and every field with *any* recorded
past change — even minutes old — read as "just changed" under the old
non-null check. Fix: judge freshness by age (`Date.now() - changedAt <
durationMs`), and on a mount that lands mid-window, show the correct
*remaining* fade time instead of restarting a full 1.5s. Existing tests had
to move from arbitrary small numbers (`1000`, `2000`) as `changedAt` to
`Date.now()`-relative values under `vi.setSystemTime`, since the new logic
is genuinely time-aware; two new tests cover the stale-on-mount (no flash)
and fresh-on-mount (correct remaining duration) cases. Verified live: typed
a search, waited ~9s for a couple of SSE mutation cycles to touch hidden
nodes, cleared the search — no highlight, versus a wall of flashing cells
before the fix.

**Non-obvious decisions worth knowing about:**
- Both bugs share a root shape: a value that's correct in isolation
  (`min-width: auto`'s content-based default; "has this ever changed") but
  wrong once combined with a *new* dynamic this app didn't have before
  step/4 — rows that can actually unmount. Neither was caught by the
  existing test suite because nothing exercised unmount/remount of table
  rows until AI search made that possible; worth remembering that adding a
  filtering feature to an already-tested view can silently invalidate
  assumptions ("this only ever mounts once") that were true until then.
- Fixed both by finding the smallest correct primitive fix (one CSS
  property; one age comparison) rather than working around the symptom
  (e.g. clearing `freshness` entries on filter change, which would have
  been a band-aid tied to this one trigger instead of the general "judge
  freshness by age" rule that also happens to fix it).

## 2026-09-14 — step/1 doc debt closed: cache layer and no-UI-kit ADRs

**Asked:** the two ADRs `CLAUDE.md` §12 named as a step/1 minimum
("in-house cache layer, and... no UI-kit") but that step/1 shipped without.
Flagged during step/2 planning and deliberately deferred rather than mixed
into step/2's or step/3's own unit of work, per the user's explicit "keep it
separate" call at the time; asked for directly once step/4 wrapped up.

**Generated (Claude Code):** `docs/adr/0004-in-house-cache-layer.md` and
`docs/adr/0005-no-ui-kit.md`, in the same Context/Decision/Alternatives/
Consequences format as 0001–0003. Both are dated to today but marked
explicitly as written retroactively for a step/1 decision, rather than
silently backdated or presented as if they'd existed all along — the
Context section of each says so directly, and each cites the actual
already-implemented code (`api/cache/useCachedResource.ts`,
`shared/ui/*`, `app/theme.ts`) rather than describing a decision in the
abstract.

**Non-obvious decisions worth knowing about:**
- Writing an ADR after the code exists is a real, if lesser, version of the
  exact risk `CLAUDE.md` §12 warns about for `ai-log.md` ("reconstructing
  from memory... is both painful and dishonest") — the mitigation here was
  reading the actual shipped code before writing either ADR, rather than
  reconstructing the reasoning from memory of the step/1 session, so the
  "Decision" sections describe what's really in the repository, not an
  idealized retelling.
- This closes every ADR `CLAUDE.md` §12 names as a minimum for the project
  (in-house cache, SSE over WebSocket, in-house aggregation, no UI kit) —
  plus 0003 for AI search, which wasn't on that original minimum list but
  was written at decision time in step/4, the way §12 actually prefers.

## 2026-09-14 — two regressions found by an external code review

**Asked:** the user ran an independent code review of the finished project
(not generated by this session) and asked for a relevance assessment before
deciding whether to act on it. Both flagged findings were verified against
the actual source before being accepted — a review's claims are exactly the
kind of thing this log's own honesty standard applies to: don't act on an
external claim any more than on an internal assumption without checking it
against the code first.

**Bug 1 — plain-text filter lost its 250ms debounce in step/4.**
`CLAUDE.md` §13 specifies "name filter with 250ms debounce," implemented
correctly in step/2. When filtering moved out of `OrgTable` into
`app/useAiSearch.ts` for step/4's AI upgrade, the plain-text path was
rewired to run on every keystroke via the *raw* `query`, while only the AI
trigger kept a debounce (400ms) — a silent regression against an explicit,
unambiguous spec line, confirmed by reading `useAiSearch.ts:72-78` directly.
Fixed by using one 250ms debounced value for both the plain-text filter and
the AI trigger, matching the spec exactly rather than inventing a separate
number for the AI path. `useAiSearch.test.ts` gained a regression test
asserting the filter does *not* apply until 250ms have elapsed.

**Bug 2 — default tree expansion one level deeper than intended.**
`CLAUDE.md` §13: "the second level expanded by default." `useTreeExpansion.ts`
expanded both the root *and* its direct children (divisions), which
additionally revealed departments (level 3) — one level past what "the
second level" describes. The more interesting part: this project's own
`docs/ai-log.md` entry for step/1 already documented the narrower,
spec-correct reading ("departments start collapsed") — the code simply
never matched what was written down as the intent, a real drift between
documentation and implementation, not a documented interpretation call. No
test covered the default expansion state at all before this. Fixed by only
adding the root's own id to the default-expanded set;
`useTreeExpansion.test.ts` (new) now locks in root-expanded /
divisions-collapsed / departments-collapsed as the default.

**Non-obvious decisions worth knowing about:**
- Neither fix touched `applyNodeChanges`, `aggregateOrgTree`, the cache
  layer, SSE reconnect, or the Docker/Nginx topology — the review confirmed
  those independently and found them correct, and nothing here disturbs
  them.
- Both bugs are the same shape: a behavior that was correct in one step
  quietly changed in a later step's refactor, with nothing catching the
  drift because nothing tested that specific number (250ms; the default
  expansion set). The fix for both is a test that pins the number down,
  not just a corrected value — the previous absence of that test is as much
  the root cause as the code itself.
- The review's other observations were weighed individually, not all acted
  on the same way: `split-view.png` was refreshed (it now shows the corrected
  default expansion) and a second screenshot added
  (`docs/screenshots/tree-view.png`, a narrow-viewport single-panel capture
  — also useful as visual proof of the expansion fix, since it shows
  divisions visible and departments collapsed cleanly); the two retroactive
  ADRs were left as-is, already honestly framed as retroactive; the
  README's "AI in development" section was left alone on the judgment that
  a link to a genuinely detailed `ai-log.md` is better practice than
  duplicating its content inline. Not every finding in a review warrants a
  code change, and saying so explicitly is preferable to quietly
  fixing everything or quietly ignoring everything.

## 2026-09-14 — AI search key configured, two real bugs found live

**Asked:** the user added a real `ANTHROPIC_API_KEY` to `.env` to exercise
the AI-success path for the first time (previously only verified via the
fallback path and injected-fetch unit tests, per ADR 0003).

**Bug 1 — `npm run dev` never loaded the root `.env` at all.** Only
`docker-compose.yml` reads `.env` (via `${ANTHROPIC_API_KEY:-}` variable
substitution); `server/src/index.ts` never had a `dotenv` import or an
`--env-file` flag, so `process.env.ANTHROPIC_API_KEY` was always empty
outside Docker, sending every dev-mode request down the "not configured"
`503` fast-fail path regardless of what was in `.env`. Fixed with
`tsx watch --env-file-if-exists=../.env` — Node's own built-in env loader
(available since Node 20.6), so no new dependency; `-if-exists` specifically
so dev without a `.env` keeps working exactly as before, unchanged.

**Bug 2 — a real upstream failure was undiagnosable from server logs.**
With the key now loading, the route logged only
`Error: Anthropic API responded 400` — `anthropicClient.ts` checked
`response.ok` and threw a status-only error, discarding the response body.
Reproducing the exact request by hand with `curl` surfaced Anthropic's real
message: the key wasn't scoped to a workspace, so the API required an
`anthropic-workspace-id` header. Fixed generically, not for this one cause:
the thrown error now includes the response body text, so the next upstream
failure (wrong model id, rate limit, anything) is readable directly from
`console.error` without a manual `curl` reproduction. The user resolved the
actual cause by generating a workspace-scoped key instead of adding
workspace-id plumbing — simpler, and it's how Anthropic's console expects
keys to be created going forward.
