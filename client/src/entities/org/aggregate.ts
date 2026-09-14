import type { OrgTreeNode } from './buildTree'

// Sums only, never averages — a weighted average can't be recomputed from
// children's averages without re-walking the subtree, but sums add up. That's
// what lets step/3's incremental patch update run in O(depth) instead of
// O(subtree). See CLAUDE.md §5.
export type Aggregate = {
  headcountTotal: number
  budgetTotal: number
  weightedPerf: number
}

export type OrgAncestor = { id: string; name: string }

export type OrgAggregateRow = {
  id: string
  name: string
  parentId: string | null
  level: number // 1-based; roots are level 1
  ancestors: OrgAncestor[] // root-first, excludes the node itself
  aggregate: Aggregate
  avgPerformance: number | null // null when headcountTotal is 0 — never NaN
}

/**
 * One post-order DFS over the tree, run once after load and memoised by the
 * caller. Level and the ancestor path fall out of the same traversal, so
 * there's no separate pass for either.
 */
export function aggregateOrgTree(roots: OrgTreeNode[]): Map<string, OrgAggregateRow> {
  const rows = new Map<string, OrgAggregateRow>()

  function visit(node: OrgTreeNode, level: number, ancestors: OrgAncestor[]): Aggregate {
    const own: Aggregate = {
      headcountTotal: node.headcount,
      budgetTotal: node.budget,
      weightedPerf: node.headcount * node.performance,
    }

    const childAncestors = [...ancestors, { id: node.id, name: node.name }]
    const aggregate = node.children.reduce<Aggregate>(
      (acc, child) => {
        const childAggregate = visit(child, level + 1, childAncestors)
        return {
          headcountTotal: acc.headcountTotal + childAggregate.headcountTotal,
          budgetTotal: acc.budgetTotal + childAggregate.budgetTotal,
          weightedPerf: acc.weightedPerf + childAggregate.weightedPerf,
        }
      },
      { ...own },
    )

    rows.set(node.id, {
      id: node.id,
      name: node.name,
      parentId: node.parentId,
      level,
      ancestors,
      aggregate,
      avgPerformance: aggregate.headcountTotal > 0 ? aggregate.weightedPerf / aggregate.headcountTotal : null,
    })

    return aggregate
  }

  for (const root of roots) {
    visit(root, 1, [])
  }

  return rows
}
