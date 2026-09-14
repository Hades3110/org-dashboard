import { createHash } from 'node:crypto'
import { Router } from 'express'
import { ORG_TREE } from '../data/generator.js'

export const orgTreeRouter = Router()

function computeETag(payload: unknown): string {
  const hash = createHash('sha1').update(JSON.stringify(payload)).digest('hex')
  return `"${hash}"`
}

function invalidPayload(): unknown[] {
  // Deliberately schema-violating: performance out of the 0-100 range, and
  // updatedAt missing — for exercising the client's zod-validation error path.
  const [first, second, ...rest] = ORG_TREE
  if (!first || !second) return []
  const { updatedAt: _updatedAt, ...secondWithoutUpdatedAt } = second
  return [{ ...first, performance: 999 }, secondWithoutUpdatedAt, ...rest]
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

orgTreeRouter.get('/org-tree', async (req, res) => {
  const scenario = typeof req.query.scenario === 'string' ? req.query.scenario : undefined
  const delayMs = Number(req.query.delay)

  if (Number.isFinite(delayMs) && delayMs > 0) {
    await delay(delayMs)
  }

  if (scenario === 'error') {
    res.status(500).json({ error: 'Internal server error (scenario=error)' })
    return
  }

  if (scenario === 'empty') {
    res.json([])
    return
  }

  if (scenario === 'invalid') {
    res.json(invalidPayload())
    return
  }

  // Real caching path only — debug scenarios above intentionally bypass ETag
  // so they're always fresh for manual testing.
  const etag = computeETag(ORG_TREE)
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end()
    return
  }
  res.setHeader('ETag', etag)
  res.json(ORG_TREE)
})
