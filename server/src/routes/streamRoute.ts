import { Router } from 'express'
import { ORG_TREE } from '../data/generator.js'
import { broadcast, subscribe } from '../stream/streamHub.js'
import { mutateRandomNodes } from '../stream/patchGenerator.js'

export const streamRouter = Router()

const MUTATION_INTERVAL_MS = 4000
const HEARTBEAT_INTERVAL_MS = 15000

streamRouter.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const unsubscribe = subscribe(res)
  req.on('close', unsubscribe)
})

// Both run unconditionally (not gated on subscriber count) so ORG_TREE keeps
// drifting even with nobody connected — that's what makes a reconnecting
// client's next revision reliably non-contiguous, exercising the gap-refetch
// path instead of leaving it untested by accident.
setInterval(() => {
  broadcast((revision) => ({ type: 'node.updated', revision, changes: mutateRandomNodes(ORG_TREE) }))
}, MUTATION_INTERVAL_MS)

setInterval(() => {
  broadcast((revision) => ({ type: 'heartbeat', revision }))
}, HEARTBEAT_INTERVAL_MS)
