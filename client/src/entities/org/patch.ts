import { z } from 'zod'

export const nodeChangeSchema = z.object({
  id: z.string().min(1),
  headcount: z.number().int().nonnegative().optional(),
  budget: z.number().nonnegative().optional(),
  performance: z.number().min(0).max(100).optional(),
  updatedAt: z.string().datetime(),
})

export const nodeUpdatedEventSchema = z.object({
  type: z.literal('node.updated'),
  revision: z.number().int().nonnegative(),
  changes: z.array(nodeChangeSchema).min(1),
})

export const heartbeatEventSchema = z.object({
  type: z.literal('heartbeat'),
  revision: z.number().int().nonnegative(),
})

export const streamEventSchema = z.discriminatedUnion('type', [nodeUpdatedEventSchema, heartbeatEventSchema])

export type NodeChange = z.infer<typeof nodeChangeSchema>
export type NodeUpdatedEvent = z.infer<typeof nodeUpdatedEventSchema>
export type HeartbeatEvent = z.infer<typeof heartbeatEventSchema>
export type StreamEvent = z.infer<typeof streamEventSchema>

// Per-node, per-field "last changed at" timestamps, used to drive the ~1.5s
// fade highlight. Lives here (not in app/ or shared/) because its shape is
// the NodeChange fields — features may depend on entities, never on app.
export type Freshness = Map<string, { headcount?: number; budget?: number; performance?: number }>
