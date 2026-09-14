import { Router } from 'express'
import { z } from 'zod'
import { callAnthropic } from '../ai/anthropicClient.js'
import { parseFilterResponse } from '../ai/parseFilterResponse.js'

export const aiSearchRouter = Router()

const requestSchema = z.object({ query: z.string().min(1).max(500) })

// `|| undefined` (not `??`), deliberately: docker-compose passes an unset
// .env value through as an empty string, not as absent — treating '' as
// "use the default" too is what keeps callAnthropic's own default parameters
// (which only trigger on `undefined`) working when nothing was configured.
const AI_SEARCH_MODEL = process.env.AI_SEARCH_MODEL || undefined
const AI_SEARCH_TIMEOUT_MS = process.env.AI_SEARCH_TIMEOUT_MS ? Number(process.env.AI_SEARCH_TIMEOUT_MS) : undefined

aiSearchRouter.post('/ai-search', async (req, res) => {
  const parsedRequest = requestSchema.safeParse(req.body)
  if (!parsedRequest.success) {
    res.status(400).json({ error: 'Invalid request body' })
    return
  }

  // No key configured — fail fast, no network attempt. This is the path
  // exercised locally without ANTHROPIC_API_KEY set; the client treats it
  // identically to any other upstream failure and falls back to plain text.
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'AI search is not configured' })
    return
  }

  try {
    const rawText = await callAnthropic(parsedRequest.data.query, {
      apiKey,
      model: AI_SEARCH_MODEL,
      timeoutMs: AI_SEARCH_TIMEOUT_MS,
    })

    const filter = parseFilterResponse(rawText)
    if (!filter) {
      res.status(502).json({ error: 'AI response was not a valid filter' })
      return
    }

    res.json({ filter })
  } catch (err) {
    console.error('ai-search: upstream call failed', err)
    res.status(502).json({ error: 'AI search upstream call failed' })
  }
})
