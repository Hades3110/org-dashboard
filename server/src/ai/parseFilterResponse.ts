import { structuredFilterSchema, type StructuredFilter } from './filterSchema.js'

// Models frequently wrap JSON in a ```json fence despite being told not to —
// strip one if present rather than trusting the prompt alone. Pure function:
// no fetch, no I/O, unit-testable without a server test runner.
function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed)
  return fenced ? fenced[1]! : trimmed
}

// Returns null on ANY failure (malformed JSON, or JSON that doesn't match
// the schema) — the caller collapses all of these into the same "fall back
// to plain text search" outcome, per CLAUDE.md §13's three named triggers
// (error, timeout, invalid JSON) all being treated identically by the client.
export function parseFilterResponse(rawText: string): StructuredFilter | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripCodeFence(rawText))
  } catch {
    return null
  }

  const result = structuredFilterSchema.safeParse(parsed)
  return result.success ? result.data : null
}
