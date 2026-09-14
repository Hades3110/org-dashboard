# CLAUDE.md

Project guide for AI assistants. Read this file before touching anything in this
repository, and re-read the relevant section before starting a new unit of work.
If something here contradicts a request, say so instead of silently picking one.

Mirror this file as `.cursorrules` (Cursor) and
`.github/copilot-instructions.md` (Copilot) so every tool sees the same rules.

---

## 1. What this project is

**Org Dashboard** — a monitoring dashboard for a company's organisational
structure. The structure is hierarchical: divisions → departments → teams. Every
node carries headcount, budget and a performance metric (0–100).

The app has two synchronised views over the same data:

- an **interactive tree** for exploring the hierarchy;
- an **analytical table** with aggregates rolled up over each subtree.

Data arrives from a local mock API as a flat array and is updated live by a
stream of patches. The interesting engineering lives in three places: the
caching layer, the aggregation algorithm, and the incremental update path.

This is a portfolio-grade codebase. Every non-obvious decision must be
explainable out loud in under a minute. Clever code that cannot be defended is
worse than plain code that can.

---

## 2. Tech stack (fixed — do not substitute)

| Area | Choice |
|---|---|
| Build | Vite 5 + React 18 + TypeScript (`strict`) |
| Styling | styled-components v6 with `ThemeProvider` |
| Schema validation | zod |
| Data caching | in-house cache layer (see §6), **not** TanStack Query |
| Realtime | SSE (see §7), **not** WebSocket |
| Testing | Vitest + @testing-library/react |
| Mock server | Node + Express + TypeScript, in-memory data |
| Deployment | Docker Compose + Nginx |

**Banned:** UI kits (MUI, Ant, Chakra, shadcn), any state manager
(Redux/MobX/Zustand), lodash, date libraries, any database, any auth.

**No new dependency may be added without asking first.** Adding one is a
proposal: name it, say what it replaces, say what it costs in bundle size.

---

## 3. Repository layout

```
client/
  src/
    app/            entry point, providers, theme, global styles
    shared/         ui primitives, hooks, formatters, pure utils
    entities/org/   zod schema, types, tree building, aggregation  ← core logic
    features/
      org-tree/     tree view
      org-table/    analytical table
      ai-search/    natural-language search
      connection/   connection status indicator
    api/            http client, cache layer, SSE client
server/
  src/              express app, seeded data generator, SSE endpoint, ETag
docs/
  architecture.md   layers and data flow from API to UI
  data-model.md     tree shape, aggregation algorithm, patch contract
  ai-log.md         running log of AI usage
  interview-prep.md likely questions per area, with answers
  adr/NNN-*.md      architecture decision records
```

**Dependency direction:** `features → entities → shared`. Never the reverse,
never feature → feature. `entities/org` must not import React — it is pure
TypeScript, which is exactly why it is testable in isolation.

Absolute imports only, via `@/*` (`tsconfig.json` paths + `vite-tsconfig-paths`).
No `../../..` anywhere.

---

## 4. Commands

```bash
npm run dev         # client + server together
npm run test         # vitest
npm run test:watch
npm run typecheck    # tsc --noEmit
npm run lint
npm run build         # production build
npm run analyze       # bundle treemap (rollup-plugin-visualizer)
docker compose up      # full stack behind nginx
```

Server debug switches, used for demoing states and for manual testing:

```
GET /api/org-tree?scenario=empty     # empty array
GET /api/org-tree?scenario=error     # 500
GET /api/org-tree?delay=5000         # slow response, for abort testing
GET /api/org-tree?scenario=invalid   # schema-violating payload
```

---

## 5. Domain model and invariants

The API returns a **flat** array:

```ts
type OrgNodeDto = {
  id: string
  name: string
  parentId: string | null
  headcount: number
  budget: number
  performance: number   // 0–100
  updatedAt: string     // ISO
}
```

The dataset has ~60 nodes across 4 depths (company → divisions → departments →
teams) and is generated from a fixed seed, so runs are reproducible.

### Building the tree

One pass into a `Map<id, node>`, then a second pass to link children. The
builder **rejects** malformed data rather than skipping nodes: duplicate ids,
unknown `parentId`, and cycles are all errors surfaced to the UI.

### Aggregation

Aggregates are stored as **sums, never as averages**:

```ts
type Aggregate = {
  headcountTotal: number   // Σ headcount over the subtree, node included
  budgetTotal: number      // Σ budget
  weightedPerf: number     // Σ (headcount × performance)
}

avgPerformance = headcountTotal > 0 ? weightedPerf / headcountTotal : null
```

This is the load-bearing decision of the whole app. A weighted average cannot be
recomputed from children's averages, but sums add up — which is what makes the
incremental update in §7 O(depth) instead of O(subtree). Do not "simplify" this
into storing averages.

- Full aggregation: one post-order DFS, run **once** after load, memoised.
- `headcountTotal === 0` → `avgPerformance` is `null`, rendered as `—`.
  Never divide by zero, never render `NaN`.
- `Уровень` / level in the table is 1-based: roots are level 1.

---

## 6. Caching layer

Hand-written, roughly 150 lines, living in `api/cache`. Public contract:

```ts
useCachedResource<T>(key, fetcher, { staleTime: 5000 })
  → { data, status: 'loading' | 'success' | 'error' | 'empty', isStale, refetch }
```

Required behaviour:

- In-memory `Map<key, { data, updatedAt, inFlight }>`.
- Fresh (age < `staleTime`) → served synchronously, **no network call**.
- Stale → served immediately, revalidated in the background (SWR).
- Concurrent subscribers to the same key share one in-flight promise.
- Every request carries an `AbortController`; it is aborted on unmount.
  `AbortError` must never surface as an error state — an aborted request is a
  normal outcome, not a failure.
- **Invalidate only on real change.** The server sends an `ETag`; the client
  sends `If-None-Match`. On `304` the cached entry keeps its identity — no new
  object reference, therefore no re-render and no re-aggregation. Verify this
  with a render counter, not by eye.

---

## 7. Realtime

`GET /api/stream` is an SSE endpoint that mutates 1–3 random nodes every few
seconds. Patch contract:

```ts
{ type: 'node.updated', revision: number,
  changes: [{ id, headcount?, budget?, performance?, updatedAt }] }

{ type: 'heartbeat', revision: number }
```

- `revision` increases monotonically. After a reconnect, a gap in the sequence
  means the client has missed patches → one full refetch. Without this the two
  views silently drift apart.
- Patches are applied **in place**: update the node, then walk to the root
  applying the delta of the three sums. No full refetch, no full re-aggregation.
- Reconnect uses our own exponential backoff (1s → 2s → 4s → … capped at 30s,
  ±20% jitter) rather than `EventSource`'s built-in retry, so the header
  indicator can reflect the real connection state.
- Changed cells get a `is-fresh` class for ~1.5s, cleared by a timer that is
  itself cleaned up on unmount.

---

## 8. Hard rules

- No `any`, no `as unknown as`, no `@ts-ignore`. `strict` and
  `noUncheckedIndexedAccess` are on and stay on.
- **No inline CSS** (`style={{}}`). All styling goes through styled-components.
- No magic numbers in markup. Spacing, colours, radii, durations come from the
  theme.
- No `useEffect` without cleanup where a subscription, timer, or request exists.
- No state updates after unmount.
- Colour is never the only carrier of meaning. The performance indicator also
  exposes a text value or `aria-label`.
- No aggregation work inside render. Memoise, then patch incrementally.
- `prefers-reduced-motion: reduce` disables transitions but must still show the
  change — swap the fade for an instant static highlight.

---

## 9. Working agreement

- **Plan before code.** Open a unit of work with the list of files you will
  touch and three to five sentences on the approach. Wait for approval.
- **One concern per turn.** Small diffs beat big ones. Do not refactor unrelated
  code while implementing a feature.
- **Do not invent requirements.** If a case isn't covered, offer two options with
  trade-offs and ask. Never decide silently.
- **Explain the non-obvious.** Roving tabindex, `grid-template-rows: 0fr`,
  delta-aggregation — each gets a short "why" in the reply and a comment in the
  code if the name doesn't already say it.
- **Stay boring.** No premature abstraction, no exotic type gymnastics, no
  frameworks-within-the-framework.
- **Close every unit of work** by running typecheck, lint, tests and build, and
  reporting the actual output.
- **Feed `docs/interview-prep.md`** after each area: three to five questions a
  reviewer could ask about the code you just wrote, with short answers.

---

## 10. Git policy — assistants do not write history

**Never run:** `git commit`, `git push`, `git tag`, `git merge`, `git rebase`,
`git reset`, `git checkout`, `git stash`, `git clean`, or anything else that
mutates the working tree, the index, or refs. No exceptions, no "just this once",
no wrapping it in a shell script or an npm script.

**Allowed (read-only):** `git status`, `git diff`, `git log`, `git show`.

Instead, when a unit of work is done, end the reply with a ready-to-paste block:

```
Suggested commit:

  feat(table): weighted performance column with subtree rollup

  - aggregate stored as sums so ancestors update in O(depth)
  - headcount 0 renders as em dash instead of NaN

Files: client/src/entities/org/aggregate.ts, client/src/features/org-table/*
Tag after committing: step/2
```

I stage, commit, tag and push myself. History is part of what gets reviewed, so
it is mine to write.

---

## 11. Development playbook

Practical guidance for day-to-day work in this repo.

### Order of work inside a feature

Types and schema → pure logic in `entities` → unit tests for that logic → hook
that wires it to the cache layer → component → styles → accessibility pass.
Writing the component first is how untestable logic ends up inside JSX.

### Testing strategy

- `entities/org` is where the real tests live: tree building, validation
  failures, aggregation, delta updates.
- The strongest test in the project: apply a random sequence of patches
  incrementally, then compare against a full recomputation from scratch. If
  those two ever disagree, the incremental path is wrong.
- Component tests cover behaviour a user can observe — sorting order, debounce,
  row click selecting a node — not implementation details.
- Don't hardcode the thousands separator in expectations. `Intl` emits `U+00A0`
  in some runtimes and `U+202F` in others; normalise before comparing, or test
  the formatter's own output shape.

### Verifying, not assuming

- Unnecessary re-renders: a render counter or the React Profiler. "It feels
  fast" is not evidence, and this project is specifically about avoiding
  redundant work.
- SSE: `curl -N http://localhost:3000/api/stream` shows the raw frames.
- Backoff and reconnect: kill the server, watch the indicator and the retry
  intervals, restart it, confirm recovery and the revision-gap refetch.
- Request cancellation: `?delay=5000`, navigate away mid-flight, confirm no
  state update warning and no error state.
- Bundle budget: `npm run analyze` before claiming anything about size.

### Common traps in this codebase

- Rebuilding the tree or re-running aggregation on every render because a new
  object reference leaked out of the cache on a `304`.
- A `useEffect` that subscribes to SSE re-running on every render because its
  dependency is an inline object or an unmemoised callback.
- Filtering the table so that matched nodes lose their ancestors, leaving
  results without context — keep the path to the root visible.
- Sorting that isn't stable, making rows jump on unrelated live updates.
- Timers from the fade highlight piling up when a node changes twice within the
  1.5s window.
- Double-click to reverse sort: a double click also fires two single clicks.
  Handle that explicitly instead of hoping.

### When you are stuck

Say so. Describe what you tried, what you observed, and the two options you see.
Do not produce a plausible-looking workaround and move on — a subtle wrong
answer costs more here than a question.

---

## 12. Documentation duties

- **ADRs are written at decision time, not afterwards.** Format: Context /
  Decision / Alternatives considered and why rejected / Consequences, including
  the downsides. At minimum: the in-house cache layer, SSE over WebSocket,
  in-house aggregation, no UI kit.
- **`docs/ai-log.md` is updated at the end of every session**, one line per
  item: what was asked → what was generated → what was rewritten by hand and
  why. Honest entries like "generated, then thrown away because it re-rendered
  the whole table" are the valuable ones. Reconstructing this log from memory at
  the end is both painful and dishonest.
- `docs/architecture.md` and `docs/data-model.md` are updated in the same unit of
  work that changes the behaviour they describe, never in a cleanup pass later.

---

## 13. Milestones

Work proceeds in four stages. Do not start a stage before the previous one is
complete — no "laying groundwork for later". Each stage ends with a commit I
make myself, tagged `step/N`.

**step/1 — Foundation.** Scaffold with absolute imports; mock server with ≥40
nodes across ≥3 levels; zod validation with invalid payloads surfacing as
errors; cache layer with 5s stale time and abort handling; interactive tree with
expand/collapse, the second level expanded by default, and name + headcount +
performance indicator per node; loading, error and empty states; zero inline CSS.

**step/2 — Core.** Tree/Table switch, plus split view from 1280px; columns
Подразделение / Уровень / Всего сотрудников / Бюджет суммарный / Средняя
эффективность; subtree rollups with headcount-weighted average performance;
aggregation computed once and memoised; sort on any column with double click
reversing; name filter with 250ms debounce; row click selects and reveals the
node in the tree; budgets formatted as `12 345 678 руб.`; unit tests for
aggregation.

**step/3 — Polish.** SSE with patches applied in place; aggregates recomputed
only for the node and its ancestors; ~1.5s fade on changed cells; connection
indicator with exponential backoff; keyboard navigation across the table
(arrows, Home/End, Enter); tree expansion animated via height transition with
`prefers-reduced-motion` respected.

**step/4 — Production and AI search.** `docker compose up` brings up client and
server, configured through `.env`; Nginx proxies the API and serves gzipped
static assets (`proxy_buffering off` for the SSE route); production bundle
≤200 KB gzip; natural-language search that returns a structured filter, with a
plain text search as fallback on error, timeout or invalid JSON — the API key
stays on the server and never reaches the bundle.

**Before handing the project over:** README with a one-command start and an
"AI in development" section; architecture and data-model docs; ADRs; screenshots
or a GIF of the finished result.

---

## 14. Pre-handoff checklist

Run through this before each stage is considered done.

1. `npm run typecheck` clean, no `any` anywhere.
2. `npm run lint` clean.
3. `npm run test` green.
4. `npm run build` succeeds.
5. No inline styles, no magic numbers in markup.
6. Every effect with a subscription, timer or request has a cleanup.
7. Loading, error and empty states all reachable via `?scenario=`.
8. Keyboard-only pass over the changed UI; visible focus ring everywhere.
9. ADRs and `docs/ai-log.md` updated.
10. `docs/interview-prep.md` extended with questions about the new code.
11. Suggested commit message printed for me — and no git command run.
