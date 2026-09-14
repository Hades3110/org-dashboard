import type { Response } from 'express'
import type { StreamEvent } from '../types.js'

// One shared revision sequence for every event this hub ever emits —
// heartbeats included. That's what lets a client detect a missed patch after
// a reconnect just by checking `revision !== lastSeen + 1`, regardless of
// whether what it missed was a patch, a heartbeat, or both.
let revision = 0
const clients = new Set<Response>()

export function subscribe(res: Response): () => void {
  clients.add(res)
  return () => {
    clients.delete(res)
  }
}

export function broadcast(build: (revision: number) => StreamEvent): void {
  revision += 1
  const event = build(revision)
  const frame = `data: ${JSON.stringify(event)}\n\n`
  for (const client of clients) {
    client.write(frame)
  }
}
