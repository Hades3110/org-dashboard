import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { OrgTreeNode } from '@/entities/org/types'
import { useTreeExpansion } from './useTreeExpansion'

function treeNode(overrides: Partial<OrgTreeNode> & Pick<OrgTreeNode, 'id'>, children: OrgTreeNode[] = []): OrgTreeNode {
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

describe('useTreeExpansion', () => {
  it('expands only the root by default — CLAUDE.md §13 "the second level expanded by default" means the root reveals level 2, not that level-2 nodes are themselves expanded', () => {
    const team = treeNode({ id: 'team', parentId: 'department' })
    const department = treeNode({ id: 'department', parentId: 'division' }, [team])
    const division = treeNode({ id: 'division', parentId: 'company' }, [department])
    const company = treeNode({ id: 'company' }, [division])

    const { result } = renderHook(() => useTreeExpansion([company]))

    expect(result.current.isExpanded('company')).toBe(true)
    expect(result.current.isExpanded('division')).toBe(false)
    expect(result.current.isExpanded('department')).toBe(false)
    expect(result.current.isExpanded('team')).toBe(false)
  })

  it('toggle flips a single node without affecting others', () => {
    const division = treeNode({ id: 'division', parentId: 'company' })
    const company = treeNode({ id: 'company' }, [division])

    const { result } = renderHook(() => useTreeExpansion([company]))

    act(() => result.current.toggle('division'))
    expect(result.current.isExpanded('division')).toBe(true)
    expect(result.current.isExpanded('company')).toBe(true) // unaffected

    act(() => result.current.toggle('division'))
    expect(result.current.isExpanded('division')).toBe(false)
  })

  it('expandAncestors expands every given id in one batch, and is a same-reference no-op when already expanded', () => {
    const department = treeNode({ id: 'department', parentId: 'division' })
    const division = treeNode({ id: 'division', parentId: 'company' }, [department])
    const company = treeNode({ id: 'company' }, [division])

    const { result } = renderHook(() => useTreeExpansion([company]))

    act(() => result.current.expandAncestors(['division', 'department']))
    expect(result.current.isExpanded('division')).toBe(true)
    expect(result.current.isExpanded('department')).toBe(true)

    const isExpandedBefore = result.current.isExpanded
    act(() => result.current.expandAncestors(['company', 'division', 'department']))
    expect(result.current.isExpanded).toBe(isExpandedBefore) // no state change, no new callback identity
  })
})
