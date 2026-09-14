import type { Aggregate, OrgAggregateRow } from './aggregate'
import type { OrgTreeNode } from './buildTree'
import type { NodeChange } from './patch'

/**
 * Applies a batch of node changes in place (mutates the OrgTreeNode fields)
 * and returns an updated aggregates Map with only the touched rows — the
 * changed node plus every ancestor on its path to the root — replaced by new
 * objects. Untouched rows keep their original reference, which costs nothing
 * extra here and is free insurance if a reference-equality optimization
 * (React.memo) is ever added on top of the table/tree later.
 *
 * This is the O(depth) path CLAUDE.md §5 was built for: rather than re-running
 * the full post-order DFS, each change contributes one delta per sum
 * (headcount, budget, weighted performance) that gets added onto every row
 * from the changed node up to the root — sums are linear, so this is exactly
 * equivalent to a full recomputation (verified by aggregateOrgTree.test.ts's
 * property test), without re-visiting any untouched subtree.
 */
export function applyNodeChanges(
  nodesById: Map<string, OrgTreeNode>,
  aggregates: Map<string, OrgAggregateRow>,
  changes: NodeChange[],
): Map<string, OrgAggregateRow> {
  const result = new Map(aggregates)

  for (const change of changes) {
    const node = nodesById.get(change.id)
    const row = result.get(change.id)
    if (!node || !row) continue // defensive: a patch for an unknown id shouldn't crash the handler

    const oldHeadcount = node.headcount
    const oldBudget = node.budget
    const oldPerformance = node.performance

    const newHeadcount = change.headcount ?? oldHeadcount
    const newBudget = change.budget ?? oldBudget
    const newPerformance = change.performance ?? oldPerformance

    const deltaHeadcount = newHeadcount - oldHeadcount
    const deltaBudget = newBudget - oldBudget
    const deltaWeightedPerf = newHeadcount * newPerformance - oldHeadcount * oldPerformance

    node.headcount = newHeadcount
    node.budget = newBudget
    node.performance = newPerformance
    node.updatedAt = change.updatedAt

    if (deltaHeadcount === 0 && deltaBudget === 0 && deltaWeightedPerf === 0) continue

    const pathToRoot = [change.id, ...row.ancestors.map((a) => a.id)]
    for (const id of pathToRoot) {
      // Read from `result`, not the original `aggregates`: if a second change
      // in this same batch shares an ancestor with this one, its delta must
      // accumulate onto what THIS change already applied, not overwrite it.
      const current = result.get(id)
      if (!current) continue

      const aggregate: Aggregate = {
        headcountTotal: current.aggregate.headcountTotal + deltaHeadcount,
        budgetTotal: current.aggregate.budgetTotal + deltaBudget,
        weightedPerf: current.aggregate.weightedPerf + deltaWeightedPerf,
      }

      result.set(id, {
        ...current,
        aggregate,
        avgPerformance: aggregate.headcountTotal > 0 ? aggregate.weightedPerf / aggregate.headcountTotal : null,
      })
    }
  }

  return result
}
