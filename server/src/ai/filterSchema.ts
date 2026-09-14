import { z } from 'zod'

// Mirrored independently in client/src/entities/org/search.ts — same
// precedent as the step/3 patch contract (server/src/types.ts vs
// client/src/entities/org/patch.ts): server and client are separate TS
// projects with no shared package, so the wire shape is duplicated rather
// than imported.
export const structuredFilterSchema = z.object({
  nameContains: z.string().min(1).optional(),
  minHeadcount: z.number().nonnegative().optional(),
  maxHeadcount: z.number().nonnegative().optional(),
  minBudget: z.number().nonnegative().optional(),
  maxBudget: z.number().nonnegative().optional(),
  minPerformance: z.number().min(0).max(100).optional(),
  maxPerformance: z.number().min(0).max(100).optional(),
  level: z.number().int().positive().optional(),
})

export type StructuredFilter = z.infer<typeof structuredFilterSchema>
