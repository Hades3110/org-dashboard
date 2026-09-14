import { z } from 'zod'
import type { OrgAggregateRow } from './aggregate'

// Mirrored independently in server/src/ai/filterSchema.ts — same precedent
// as the step/3 patch contract (server/src/types.ts vs
// client/src/entities/org/patch.ts): no shared package between the two TS
// projects, so the wire shape is duplicated on purpose.
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

// Same reference on a no-op filter as filterRowsByName — keeps a downstream
// sort memo from re-running when nothing was actually constrained.
export function applyStructuredFilter(rows: OrgAggregateRow[], filter: StructuredFilter): OrgAggregateRow[] {
  if (Object.keys(filter).length === 0) return rows

  return rows.filter((row) => {
    if (filter.nameContains && !row.name.toLowerCase().includes(filter.nameContains.toLowerCase())) return false
    if (filter.minHeadcount !== undefined && row.aggregate.headcountTotal < filter.minHeadcount) return false
    if (filter.maxHeadcount !== undefined && row.aggregate.headcountTotal > filter.maxHeadcount) return false
    if (filter.minBudget !== undefined && row.aggregate.budgetTotal < filter.minBudget) return false
    if (filter.maxBudget !== undefined && row.aggregate.budgetTotal > filter.maxBudget) return false
    // A row with no performance data (headcountTotal 0) never matches a
    // performance-range filter — it has nothing to compare, not "anything goes".
    if (filter.minPerformance !== undefined && (row.avgPerformance === null || row.avgPerformance < filter.minPerformance))
      return false
    if (filter.maxPerformance !== undefined && (row.avgPerformance === null || row.avgPerformance > filter.maxPerformance))
      return false
    if (filter.level !== undefined && row.level !== filter.level) return false
    return true
  })
}
