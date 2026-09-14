# ADR 0003: Natural-language search — raw fetch, prompt-JSON, fallback on any failure

**Status:** Accepted
**Date:** 2026-09-14 (step/4)

## Context

CLAUDE.md §13 asks for natural-language search that returns a structured
filter, with a plain text search as fallback on error, timeout, or invalid
JSON, and the API key never reaching the client bundle. No provider is
specified. Confirmed with the user: Anthropic Claude API, built without a key
in this environment (none was set), verified end-to-end via the fallback
path — a real key gets dropped into `.env` afterward to exercise the
AI-success path.

## Decision

`POST /api/ai-search { query }` → the server calls the Anthropic Messages API
via a raw `fetch` (no SDK — a single POST with two headers doesn't justify a
new dependency, CLAUDE.md §2) with a system prompt describing the org-chart
fields and instructing JSON-only output. The response text is parsed
(stripping a possible ` ```json ` fence) and zod-validated against a
`StructuredFilter` schema before being trusted.

The client (`app/useAiSearch.ts`) debounces the query by 250ms — the exact
value `CLAUDE.md` §13 specifies for the plain-text name filter — and that
single debounced value drives both `filterRowsByName` (already built in
step/2) and the AI request in the background. On success, the view upgrades
to the AI's structured filter; on **any** failure — non-2xx status, timeout,
or a response that isn't valid JSON matching the schema — the client simply
never upgrades, silently staying on the plain-text result. "Fallback" is
therefore not a distinct code path on the client, just the absence of a
still-current AI result.

The key lives only in the `server` container's environment
(`ANTHROPIC_API_KEY`); no build step or bundle ever references it.

## Alternatives considered and rejected

- **The Anthropic TypeScript SDK.** Would add a real dependency for one API
  call this project makes in one place. `fetch` plus a ~20-line wrapper
  (`server/src/ai/anthropicClient.ts`) covers the whole surface used here:
  one endpoint, two headers, a JSON body, an `AbortController` timeout.
- **Tool-use / forced function-calling** for the structured output, instead
  of prompting for raw JSON. More reliable in principle, but meaningfully
  more code (tool schema, `tool_choice`, parsing a different response shape)
  for a five-field object — and CLAUDE.md explicitly names "invalid JSON" as
  one of the three conditions the fallback exists to absorb, meaning the
  simpler approach's occasional misses are a designed-for outcome, not a
  gap to engineer away.
- **A separate, longer debounce just for the AI call**, on top of the
  spec'd 250ms for the plain-text filter. Considered and rejected: the
  250ms pause the user already has to make before the text filter itself
  updates is also a perfectly reasonable trigger point for the AI request —
  adding a second, larger delay on top would only mean the AI upgrade lands
  later without buying anything, since a single debounced value already
  guarantees at most one request per pause in typing.
- **Blocking the search input on the AI call**, i.e. not showing the
  plain-text result until the AI call resolves. Rejected: it would mean
  every search either waits on a network round trip beyond the spec'd
  250ms, or needs the plain-text result suppressed for no reason while a
  slower network call is still in flight. Layering the AI call as a
  background upgrade over the already-debounced plain-text result avoids
  ever presenting a search box that does nothing while "thinking," without
  reintroducing per-keystroke filtering to get there.
- **A visible "AI search failed" error state.** Rejected in favor of silence:
  the plain-text result was already on screen before the AI call started
  (progressive enhancement, not a fallback the user has to notice) — an error
  toast would be more alarming than informative for something the user asked
  a fuzzy natural-language question and got fuzzy-but-real substring results
  back for.

## Consequences

- Without `ANTHROPIC_API_KEY` configured, the server route fails fast (`503`,
  no network attempt) — this is the only path verified live in this
  environment; the AI-success path is covered by `useAiSearch.test.ts`
  against an injected fake `fetch` instead of a real call.
- No server test runner was added for this route either (same call as
  step/3's `patchGenerator` — `server/src/ai/parseFilterResponse.ts` stays
  pure and testable-later without one); the fallback contract's real test
  coverage lives client-side, where a fake `fetch` can simulate every
  failure mode deterministically.
- The model can hallucinate a filter that doesn't match user intent (e.g.
  misreading "team" as `level: 4` when the user meant something else) — this
  is an accepted characteristic of natural-language search, not something
  the fallback path guards against (the fallback only covers hard failures:
  bad status, timeout, malformed JSON — not "technically valid but
  semantically wrong" filters).
- `AI_SEARCH_MODEL` and `AI_SEARCH_TIMEOUT_MS` are both overridable via
  `.env` without a code change, in case the default model is deprecated or
  8s proves too tight or too generous in practice.

**Correction (same day):** the design as first shipped applied the
plain-text filter to every keystroke with no debounce at all, only
debouncing the AI trigger (at 400ms) — a real regression against
`CLAUDE.md` §13's explicit "name filter with 250ms debounce," introduced
when filtering moved out of `OrgTable` into this hook and not caught before
merging. Found via an external code review, verified against the source
before accepting the finding, and fixed: a single 250ms debounce now drives
both the plain-text filter and the AI trigger, as described above. See
`docs/ai-log.md` for the fuller write-up.
