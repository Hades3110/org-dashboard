import { describe, expect, it } from 'vitest'
import { aggregateOrgTree } from './aggregate'
import type { OrgTreeNode } from './buildTree'

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

describe('aggregateOrgTree', () => {
  it('sums a single leaf onto itself', () => {
    const leaf = treeNode({ id: 'leaf', headcount: 10, budget: 1000, performance: 80 })

    const rows = aggregateOrgTree([leaf])
    const row = rows.get('leaf')

    expect(row?.aggregate).toEqual({ headcountTotal: 10, budgetTotal: 1000, weightedPerf: 800 })
    expect(row?.avgPerformance).toBe(80)
  })

  it('rolls up as a headcount-weighted average, not a simple mean of children', () => {
    // small (10 people, perf 100) vs. large (90 people, perf 0): a simple mean
    // of children would give 50; the correct weighted result is 10.
    const small = treeNode({ id: 'small', parentId: 'parent', headcount: 10, budget: 100, performance: 100 })
    const large = treeNode({ id: 'large', parentId: 'parent', headcount: 90, budget: 900, performance: 0 })
    const parent = treeNode({ id: 'parent', headcount: 0, budget: 0, performance: 50 }, [small, large])

    const rows = aggregateOrgTree([parent])
    const row = rows.get('parent')

    expect(row?.aggregate.headcountTotal).toBe(100)
    expect(row?.avgPerformance).toBe(10)
  })

  it('rolls up transitively through grandchildren', () => {
    const grandchild = treeNode({ id: 'gc', headcount: 5, budget: 50, performance: 60 })
    const child = treeNode({ id: 'child', headcount: 5, budget: 50, performance: 40 }, [grandchild])
    const root = treeNode({ id: 'root', headcount: 0, budget: 0, performance: 0 }, [child])

    const rows = aggregateOrgTree([root])
    const rootRow = rows.get('root')

    expect(rootRow?.aggregate.headcountTotal).toBe(10)
    expect(rootRow?.aggregate.budgetTotal).toBe(100)
    expect(rootRow?.avgPerformance).toBe(50) // (5*40 + 5*60) / 10
  })

  it('returns null avgPerformance when headcountTotal is zero, never NaN', () => {
    const child = treeNode({ id: 'child', headcount: 0, budget: 500, performance: 70 })
    const root = treeNode({ id: 'root', headcount: 0, budget: 0, performance: 0 }, [child])

    const rows = aggregateOrgTree([root])
    const avg = rows.get('root')?.avgPerformance

    expect(avg).toBeNull()
    expect(Number.isNaN(avg)).toBe(false)
  })

  it('computes a 1-based level per depth', () => {
    const grandchild = treeNode({ id: 'gc' })
    const child = treeNode({ id: 'child' }, [grandchild])
    const root = treeNode({ id: 'root' }, [child])

    const rows = aggregateOrgTree([root])

    expect(rows.get('root')?.level).toBe(1)
    expect(rows.get('child')?.level).toBe(2)
    expect(rows.get('gc')?.level).toBe(3)
  })

  it('tracks root-first ancestors, excluding the node itself', () => {
    const grandchild = treeNode({ id: 'gc', name: 'Grandchild' })
    const child = treeNode({ id: 'child', name: 'Child' }, [grandchild])
    const root = treeNode({ id: 'root', name: 'Root' }, [child])

    const rows = aggregateOrgTree([root])

    expect(rows.get('root')?.ancestors).toEqual([])
    expect(rows.get('child')?.ancestors).toEqual([{ id: 'root', name: 'Root' }])
    expect(rows.get('gc')?.ancestors).toEqual([
      { id: 'root', name: 'Root' },
      { id: 'child', name: 'Child' },
    ])
  })

  it('aggregates each root of a forest independently at level 1', () => {
    const a = treeNode({ id: 'a', headcount: 5, budget: 50, performance: 20 })
    const b = treeNode({ id: 'b', headcount: 15, budget: 150, performance: 80 })

    const rows = aggregateOrgTree([a, b])

    expect(rows.get('a')?.level).toBe(1)
    expect(rows.get('b')?.level).toBe(1)
    expect(rows.get('a')?.avgPerformance).toBe(20)
    expect(rows.get('b')?.avgPerformance).toBe(80)
  })

  it('does not mutate the input tree', () => {
    const child = treeNode({ id: 'child', headcount: 5, budget: 50, performance: 60 })
    const root = treeNode({ id: 'root', headcount: 5, budget: 50, performance: 40 }, [child])
    const snapshot = JSON.parse(JSON.stringify([root])) as unknown

    aggregateOrgTree([root])

    expect(JSON.parse(JSON.stringify([root]))).toEqual(snapshot)
  })
})
