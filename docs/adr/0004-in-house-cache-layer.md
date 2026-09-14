# ADR 0004: Hand-written cache layer instead of TanStack Query

**Status:** Accepted
**Date:** 2026-09-14 (written retroactively for step/1 — see Context)

## Context

This ADR documents a decision that was implemented in step/1 but not written
up at the time — flagged during step/2 planning as doc debt and deliberately
deferred rather than folded into an unrelated unit of work, per the working
agreement. The code (`api/cache/useCachedResource.ts`) and its behavior have
not changed since; this records the reasoning that was already implicit in
`CLAUDE.md` §6's contract.

`CLAUDE.md` §1 calls out the caching layer as one of three places "the
interesting engineering lives" in this project, and §2 fixes the choice
outright: an in-house cache layer, explicitly **not** TanStack Query. The
required contract (§6):

```ts
useCachedResource<T>(key, fetcher, { staleTime: 5000 })
  → { data, status: 'loading' | 'success' | 'error' | 'empty', isStale, refetch }
```

with stale-while-revalidate semantics, concurrent-subscriber request sharing,
abort-per-request cleanup, and ETag-based 304 identity preservation.

## Decision

A hand-written, `useSyncExternalStore`-backed cache (`api/cache/useCachedResource.ts`,
~170 lines including comments):

- **Module-level `Map<key, CacheEntry>`**, not React state or Context — the
  store lives outside React entirely, so any component can call
  `useCachedResource(key, …)` without being wrapped in a provider, and the
  cache survives across whatever part of the tree happens to be mounted.
  `useSyncExternalStore` is the React 18-correct way to subscribe a component
  to state that lives outside React's own render cycle — a hand-rolled
  `useState`/`useEffect` subscription would risk missing an update that lands
  between render and effect commit.
- **Freshness by age**: `age = Date.now() - entry.updatedAt`; `age <
  staleTime` serves the cached snapshot synchronously with zero network
  calls. Stale data is still served immediately (no loading flash on a
  revalidating fetch) while a background fetch runs.
- **Shared in-flight promise**: `entry.inFlight` means concurrent subscribers
  to the same key never issue duplicate requests — the second (and third,
  …) caller just awaits the first's promise.
- **Abort discipline**: every fetch gets its own `AbortController`; it's
  aborted when the last listener for that key unsubscribes (not the first —
  sharing means the request stays alive for as long as anyone still wants
  it). `AbortError` is filtered out of the error path entirely — an aborted
  request is a normal outcome (a component unmounted, a stale key changed),
  never surfaced as a failure state.
- **ETag/304 identity preservation**: on a `304`, `entry.snapshot.data` keeps
  its *existing object reference* and `notify()` is deliberately skipped —
  zero re-renders, not just a fast update. This is the detail
  `docs/architecture.md`'s data-flow section depends on: `buildOrgTree` and
  `aggregateOrgTree` are memoized on this same reference, so an unchanged
  poll skips tree-building and aggregation entirely, not just the fetch.
- **`isStale` computed at render time** from `entry.updatedAt`, not stored in
  the synced snapshot — flipping stale-to-true doesn't call `notify()`,
  matching §6's "304 causes zero re-renders" requirement literally rather
  than approximately.

## Alternatives considered and rejected

- **TanStack Query.** Explicitly ruled out by `CLAUDE.md` §2. Beyond the
  spec, the reasoning holds up: React Query would hide exactly the mechanics
  this project exists to demonstrate — SWR revalidation, request dedup,
  cancellation, conditional-fetch identity preservation. Importing a library
  that solves this invisibly removes the thing being evaluated for a
  portfolio-grade codebase (`CLAUDE.md` §1: "clever code that cannot be
  defended is worse than plain code that can" — the inverse risk here is
  code that was never written and so can't be defended either).
- **SWR (the Vercel library).** Smaller and more minimal than React Query,
  but rejected for the identical reason — it's still a dependency that
  replaces the exact code being showcased, not a meaningfully different
  trade-off.
- **A `useEffect` + `useState` fetch-on-mount pattern, no cache.** The naive
  baseline. Rejected because it satisfies none of §6's actual requirements:
  every remount refetches (no stale-time serving), no cross-subscriber
  sharing, no structural place to hang ETag/abort logic — it would need to
  grow into this design anyway, just less deliberately.
- **A Context-based store** instead of a module-level `Map`. Would tie the
  cache's lifetime to wherever a `<CacheProvider>` is mounted and require
  every consumer to sit inside it. The module-level store needs no provider
  component at all and imposes no tree-position constraint — simpler for a
  single-key dashboard today, and no harder to reason about if more keys are
  added later.

## Consequences

- No automatic garbage collection of unused entries — a `CacheEntry` for a
  given key lives in the module-level `Map` for the page's lifetime once
  created. Fine at this app's scale (effectively one key,
  `ORG_TREE_CACHE_KEY`); a version of this app with many dynamic keys would
  need explicit eviction, which this implementation doesn't have.
- No query-invalidation graph (React Query's "invalidate this key and
  everything depending on it" model) — invalidation here is just `refetch()`
  resetting `entry.updatedAt` to force `ensureFresh` to treat the entry as
  stale. Sufficient for this app's single-resource shape; would need real
  dependency tracking to scale to a multi-resource app with cross-key
  invalidation rules.
- The 304-identity-preservation contract is a hard coupling: any future
  fetcher for a new cache key that *doesn't* correctly return `{ status:
  'not-modified' }` on an unchanged response would silently lose this
  optimization (still correct, just not free) rather than fail loudly —
  worth a code comment at any future fetcher call site, not just here.
- Tested directly against this contract, not against implementation details:
  `useCachedResource.test.ts` covers fresh-serve-without-network,
  background-revalidation-while-serving-stale, 304-keeps-identity-and-skips-notify,
  and abort-is-not-an-error — the four behaviors §6 actually specifies.
