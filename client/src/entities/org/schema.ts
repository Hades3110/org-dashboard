import { z } from 'zod'

export const orgNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  headcount: z.number().int().nonnegative(),
  budget: z.number().nonnegative(),
  performance: z.number().min(0).max(100),
  updatedAt: z.string().datetime(),
})

export const orgTreeResponseSchema = z.array(orgNodeSchema)

export type OrgNodeDto = z.infer<typeof orgNodeSchema>
