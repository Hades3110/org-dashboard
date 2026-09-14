# ADR 0001: In-house aggregation, stored as sums

**Status:** Accepted
**Date:** 2026-09-14 (step/2)

## Context

The analytical table needs subtree rollups per node: total headcount, total
budget, and a headcount-weighted average performance, for every node in the
tree. Step/3 will add live SSE patches that mutate 1-3 nodes at a time, and
those rollups must stay correct after each patch without redoing the whole
computation.

## Decision

Store aggregates as **sums**, never as averages:

```ts
type Aggregate = { headcountTotal: number; budgetTotal: number; weightedPerf: number }
avgPerformance = headcountTotal > 0 ? weightedPerf / headcountTotal : null
```

Compute them with one post-order DFS (`aggregateOrgTree`), run once after
load and memoised — not on every render. This step (step/2) only builds the
one-shot computation; the incremental per-patch update (apply a patch to one
node, then walk to the root re-summing each ancestor from its own values plus
its children's current aggregates) is step/3 scope.

## Alternatives considered and rejected

- **Store the average directly on each node.** Not recomputable from
  children's averages without re-walking the subtree on every change — a
  parent's average isn't a function of its children's averages alone (it
  needs their weights, i.e. their headcounts, which is exactly the sum this
  ADR keeps instead).
- **Recompute the full aggregation on every future SSE patch.** Correct, but
  O(n) per patch against O(depth) for the sum-based approach — the difference
  step/3 exists to avoid, given patches arrive every few seconds.
- **A third-party hierarchy/aggregation library.** Unnecessary dependency for
  a ~60-line pure function with no external requirements; `CLAUDE.md` §2
  requires justifying any new dependency by name, replacement, and bundle
  cost, and none of that is warranted here.

## Consequences

- Every consumer must derive `avgPerformance` from the stored sums via the
  formula above, with the null guard — never read or store an average field
  directly, or the O(depth) update path breaks.
- `weightedPerf` could lose floating-point precision on a very large tree
  (repeated summation); not a concern at ~60-70 nodes, but worth flagging if
  the seed size ever grows by orders of magnitude.
- The incremental update itself doesn't exist yet — until step/3 lands,
  `aggregateOrgTree` runs from scratch on every real data change, which is
  fine at this scale but is not the O(depth) path this decision is building
  toward.
