import { describe, expect, it } from 'vitest'
import { aggregateOrgTree } from './aggregate'
import { applyNodeChanges } from './applyPatch'
import type { OrgTreeNode } from './buildTree'
import type { NodeChange } from './patch'

function treeNode(
  overrides: Partial<OrgTreeNode> & Pick<OrgTreeNode, 'id'>,
  children: OrgTreeNode[] = [],
): OrgTreeNode {
  return {
    name: overrides.id,
    parentId: null,
    headcount: 1,
    budget: 1,
    performance: 50,
    updatedAt: '2026-01-01T00:00:00.000Z',
    children,
    ...overrides,
  }
}

function indexById(roots: OrgTreeNode[]): Map<string, OrgTreeNode> {
  const byId = new Map<string, OrgTreeNode>()
  function visit(node: OrgTreeNode) {
    byId.set(node.id, node)
    node.children.forEach(visit)
  }
  roots.forEach(visit)
  return byId
}

function change(overrides: Partial<NodeChange> & Pick<NodeChange, 'id'>): NodeChange {
  return { updatedAt: '2026-01-02T00:00:00.000Z', ...overrides }
}

describe('applyNodeChanges', () => {
  it('updates the changed node and every ancestor by the exact delta', () => {
    const grandchild = treeNode({ id: 'gc', headcount: 5, budget: 50, performance: 60 })
    const child = treeNode({ id: 'child', headcount: 5, budget: 50, performance: 40 }, [grandchild])
    const root = treeNode({ id: 'root', headcount: 0, budget: 0, performance: 0 }, [child])
    const nodesById = indexById([root])
    const aggregates = aggregateOrgTree([root])

    const result = applyNodeChanges(nodesById, aggregates, [change({ id: 'gc', headcount: 15 })])

    // gc: headcount 5 -> 15, delta +10, weightedPerf delta = 15*60 - 5*60 = +600
    expect(result.get('gc')?.aggregate).toEqual({ headcountTotal: 15, budgetTotal: 50, weightedPerf: 900 })
    expect(result.get('child')?.aggregate.headcountTotal).toBe(20) // 5 (own) + 15 (gc)
    expect(result.get('root')?.aggregate.headcountTotal).toBe(20)
    // Mutates the tree node in place too.
    expect(grandchild.headcount).toBe(15)
  })

  it('leaves headcount/budget sums untouched when only performance changes', () => {
    const node = treeNode({ id: 'leaf', headcount: 10, budget: 100, performance: 50 })
    const nodesById = indexById([node])
    const aggregates = aggregateOrgTree([node])

    const result = applyNodeChanges(nodesById, aggregates, [change({ id: 'leaf', performance: 90 })])

    expect(result.get('leaf')?.aggregate.headcountTotal).toBe(10)
    expect(result.get('leaf')?.aggregate.budgetTotal).toBe(100)
    expect(result.get('leaf')?.avgPerformance).toBe(90)
  })

  it('returns null avgPerformance (never NaN) when headcount drops to zero', () => {
    const node = treeNode({ id: 'leaf', headcount: 10, budget: 100, performance: 50 })
    const nodesById = indexById([node])
    const aggregates = aggregateOrgTree([node])

    const result = applyNodeChanges(nodesById, aggregates, [change({ id: 'leaf', headcount: 0 })])
    const avg = result.get('leaf')?.avgPerformance

    expect(avg).toBeNull()
    expect(Number.isNaN(avg)).toBe(false)
  })

  it('accumulates deltas from two changes in the same batch that share an ancestor', () => {
    const a = treeNode({ id: 'a', headcount: 10, budget: 0, performance: 0 })
    const b = treeNode({ id: 'b', headcount: 10, budget: 0, performance: 0 })
    const root = treeNode({ id: 'root', headcount: 0, budget: 0, performance: 0 }, [a, b])
    const nodesById = indexById([root])
    const aggregates = aggregateOrgTree([root])

    const result = applyNodeChanges(nodesById, aggregates, [
      change({ id: 'a', headcount: 20 }), // +10
      change({ id: 'b', headcount: 30 }), // +20
    ])

    expect(result.get('root')?.aggregate.headcountTotal).toBe(50) // 0 + 20 + 30
  })

  it('ignores a change for an unknown id instead of throwing', () => {
    const node = treeNode({ id: 'leaf' })
    const nodesById = indexById([node])
    const aggregates = aggregateOrgTree([node])

    expect(() => applyNodeChanges(nodesById, aggregates, [change({ id: 'ghost', headcount: 5 })])).not.toThrow()
  })

  it('does not replace rows untouched by the patch (same object reference)', () => {
    const a = treeNode({ id: 'a', headcount: 5 })
    const b = treeNode({ id: 'b', headcount: 5 })
    const root = treeNode({ id: 'root', headcount: 0 }, [a, b])
    const nodesById = indexById([root])
    const aggregates = aggregateOrgTree([root])
    const untouchedRowBefore = aggregates.get('b')

    const result = applyNodeChanges(nodesById, aggregates, [change({ id: 'a', headcount: 50 })])

    expect(result.get('b')).toBe(untouchedRowBefore)
  })

  // The strongest test: apply a random sequence of patches incrementally and
  // compare against a full from-scratch recomputation after every step. If
  // these ever disagree, the incremental path is wrong (CLAUDE.md §11).
  it('matches a full recomputation after any sequence of random patches', () => {
    function mulberry32(seed: number) {
      let a = seed
      return () => {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }

    function buildRandomTree(rng: () => number): OrgTreeNode[] {
      const leaf = (id: string) =>
        treeNode({ id, headcount: Math.floor(rng() * 20), budget: Math.floor(rng() * 1000), performance: Math.floor(rng() * 100) })

      const gc1 = leaf('gc1')
      const gc2 = leaf('gc2')
      const child1 = treeNode(
        { id: 'child1', headcount: Math.floor(rng() * 20), budget: Math.floor(rng() * 1000), performance: Math.floor(rng() * 100) },
        [gc1, gc2],
      )
      const child2 = leaf('child2')
      const root = treeNode(
        { id: 'root', headcount: Math.floor(rng() * 20), budget: Math.floor(rng() * 1000), performance: Math.floor(rng() * 100) },
        [child1, child2],
      )
      return [root]
    }

    for (let seed = 1; seed <= 5; seed++) {
      const rng = mulberry32(seed * 7919)
      const roots = buildRandomTree(rng)
      const nodesById = indexById(roots)
      let aggregates = aggregateOrgTree(roots)
      const ids = [...nodesById.keys()]

      for (let step = 0; step < 20; step++) {
        const targetId = ids[Math.floor(rng() * ids.length)]
        if (!targetId) continue

        const patchChange: NodeChange = { id: targetId, updatedAt: `2026-01-0${(step % 9) + 1}T00:00:00.000Z` }
        if (rng() < 0.5) patchChange.headcount = Math.floor(rng() * 30)
        if (rng() < 0.5) patchChange.budget = Math.floor(rng() * 2000)
        if (rng() < 0.5) patchChange.performance = Math.floor(rng() * 100)

        aggregates = applyNodeChanges(nodesById, aggregates, [patchChange])
        const fromScratch = aggregateOrgTree(roots)

        for (const id of ids) {
          expect(aggregates.get(id)?.aggregate).toEqual(fromScratch.get(id)?.aggregate)
          expect(aggregates.get(id)?.avgPerformance).toBe(fromScratch.get(id)?.avgPerformance)
        }
      }
    }
  })
})
