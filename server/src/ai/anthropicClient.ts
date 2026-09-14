const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022'
const DEFAULT_TIMEOUT_MS = 8000

const SYSTEM_PROMPT = `You translate a natural-language search query about a company org chart into a JSON filter. The org chart's rows each have: name (string), headcount (subtree total, integer), budget (subtree total, in rubles), performance (subtree average, 0-100), and level (1 = the whole company, 2 = divisions, 3 = departments, 4 = teams).

Respond with ONLY a JSON object (no prose, no markdown fence) using a subset of these optional fields:
{
  "nameContains": string,
  "minHeadcount": number, "maxHeadcount": number,
  "minBudget": number, "maxBudget": number,
  "minPerformance": number, "maxPerformance": number,
  "level": number
}

Include only the fields implied by the query. If the query only names a department or team, use "nameContains". If nothing in the query maps to a filter, respond with {}.`

export type AnthropicClientOptions = {
  apiKey: string
  model?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

// A thin wrapper around the Messages API, not an SDK — a single POST with
// two headers and a JSON body doesn't justify a new dependency (CLAUDE.md
// §2 requires naming/justifying any new one). `fetchImpl` is injectable so
// the route's own logic could be unit-tested later without a real network
// call, following the same seam used for useSseConnection's EventSource
// factory on the client.
export async function callAnthropic(query: string, options: AnthropicClientOptions): Promise<string> {
  const { apiKey, model = DEFAULT_MODEL, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = options

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: query }],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      // Anthropic's error body (type + message) is far more useful for
      // debugging than the status code alone — e.g. distinguishing "bad
      // model id" from "key not scoped to a workspace" both surface as 400.
      const errorBody = await response.text()
      throw new Error(`Anthropic API responded ${response.status}: ${errorBody}`)
    }

    const body = (await response.json()) as { content?: { type: string; text?: string }[] }
    const text = body.content?.find((block) => block.type === 'text')?.text
    if (!text) {
      throw new Error('Anthropic API response had no text content')
    }
    return text
  } finally {
    clearTimeout(timer)
  }
}
