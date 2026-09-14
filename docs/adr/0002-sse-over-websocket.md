# ADR 0002: SSE over WebSocket for realtime updates, with our own reconnect

**Status:** Accepted
**Date:** 2026-09-14 (step/3)

## Context

The dashboard needs a live stream of node mutations (1-3 nodes changing every
few seconds) so the tree and table update without polling. `CLAUDE.md` §2
already fixes the choice to SSE, not WebSocket — this ADR records why, since
"just use WebSocket" is the first alternative any reviewer will raise.

## Decision

Use `GET /api/stream`, a single one-way SSE endpoint, for two event types:

```ts
{ type: 'node.updated', revision: number, changes: NodeChange[] }
{ type: 'heartbeat', revision: number }
```

Both event types share **one** monotonically increasing `revision` sequence
(`server/src/stream/streamHub.ts`'s `broadcast()`), which is what makes gap
detection on the client meaningful regardless of which event kind arrived —
a heartbeat closes the same gap a mutation would.

The client does **not** use `EventSource`'s built-in auto-retry. On `onerror`,
`useSseConnection` explicitly `.close()`s the dead connection, sets status to
`'reconnecting'`, and schedules its own reconnect via `setTimeout` with
exponential backoff (`1000 * 2^attempt`, capped at 30000ms, then ±20% jitter
applied *after* the cap). `attempt` resets to 0 on a successful `onopen`.

## Alternatives considered and rejected

- **WebSocket.** The data flow here is one-way (server → client); nothing the
  client sends back needs a socket. WebSocket would add reconnect logic,
  framing, and a keep-alive story of its own — the same reconnect problem SSE
  already has to solve, for a bidirectional channel we don't use. `EventSource`
  gets HTTP/2 multiplexing, plain-text framing readable via `curl -N`, and a
  simpler server (an Express route, not a separate protocol upgrade) for free.
- **`EventSource`'s built-in reconnect.** It exists, but it's opaque: no
  `retryDelayMs` to show the user, no hook to surface `'reconnecting'` vs.
  `'connecting'` vs. `'open'` as distinct states, and no control over backoff
  shape (the spec only mandates *a* retry delay, browsers are free to choose
  their own scheme). The connection indicator (CLAUDE.md §7/§13) needs a real
  number to count down, so the retry loop has to be ours regardless — at which
  point relying on the browser's version too would mean two competing retry
  loops racing each other after a single drop.
- **A replay buffer on reconnect (server resends missed patches).** Would let
  the client skip the gap-triggered refetch entirely, but costs unbounded
  server-side memory for a buffer whose size depends on how long a client can
  stay disconnected, plus ordering/dedup logic on the client. At this scale (a
  few nodes changing every 4s) a full refetch on a detected gap is cheap and
  correct without any of that — see Consequences.

## Consequences

- No replay buffer means a **gap in `revision` is the only signal** a client
  has that it missed something; the client's response to a gap is a full
  refetch (`useOrgStream`'s `lastRevisionRef` check), not a partial patch.
  This makes the gap check load-bearing, not decorative — if it were ever
  removed, a client that reconnects after missing patches would silently
  drift from the server's real state with no visible symptom until the two
  views disagree with each other.
- Heartbeats exist purely to advance `revision` on a schedule (15s) even when
  no mutation lands, so a long quiet period doesn't get misread as a missed
  patch — without them, a gap check would have false positives whenever the
  4s mutation interval happened to skip a beat.
- Hand-rolled backoff means hand-rolled tests: `useSseConnection.test.ts`
  injects a fake `EventSource` factory (jsdom has none natively) and asserts
  `close()` is actually called on error — proof the hook isn't quietly
  trusting the browser's own retry underneath ours.
- One-way only: if the app ever needs the client to push something back
  (e.g. an edit), that would need a second channel (a plain POST, most likely)
  rather than repurposing this stream — SSE has no client→server leg by
  design.
