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

The client (`app/useAiSearch.ts`) never blocks on this call: the raw query
drives an **instant** local plain-text filter (`filterRowsByName`, already
built in step/2) while a 400ms-debounced copy of the query fires the AI
request in the background. On success, the view upgrades to the AI's
structured filter; on **any** failure — non-2xx status, timeout, or a
response that isn't valid JSON matching the schema — the client simply never
upgrades, silently staying on the already-displayed plain-text result.
"Fallback" is therefore not a distinct code path on the client, just the
absence of a still-current AI result.

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
- **Blocking the search input on the AI call.** Would mean every keystroke
  either waits on a network round trip or needs its own separate debounce
  tuning against typing speed. Layering the AI call as a background upgrade
  over an already-working instant filter avoids ever presenting a search box
  that does nothing while "thinking."
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
