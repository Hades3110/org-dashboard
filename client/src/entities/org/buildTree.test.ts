import { describe, expect, it } from 'vitest'
import { buildOrgTree, OrgTreeBuildError } from './buildTree'
import type { OrgNodeDto } from './schema'

function node(overrides: Partial<OrgNodeDto> & Pick<OrgNodeDto, 'id' | 'parentId'>): OrgNodeDto {
  return {
    name: overrides.id,
    headcount: 1,
    budget: 1,
    performance: 50,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildOrgTree', () => {
  it('links children under their parent and finds the root', () => {
    const flat: OrgNodeDto[] = [
      node({ id: 'company', parentId: null }),
      node({ id: 'division-1', parentId: 'company' }),
      node({ id: 'department-1', parentId: 'division-1' }),
      node({ id: 'team-1', parentId: 'department-1' }),
    ]

    const roots = buildOrgTree(flat)

    expect(roots).toHaveLength(1)
    expect(roots[0]?.id).toBe('company')
    expect(roots[0]?.children[0]?.id).toBe('division-1')
    expect(roots[0]?.children[0]?.children[0]?.id).toBe('department-1')
    expect(roots[0]?.children[0]?.children[0]?.children[0]?.id).toBe('team-1')
  })

  it('supports a forest of multiple roots', () => {
    const flat: OrgNodeDto[] = [node({ id: 'a', parentId: null }), node({ id: 'b', parentId: null })]

    const roots = buildOrgTree(flat)

    expect(roots.map((r) => r.id).sort()).toEqual(['a', 'b'])
  })

  it('throws on a duplicate id', () => {
    const flat: OrgNodeDto[] = [node({ id: 'a', parentId: null }), node({ id: 'a', parentId: null })]

    expect(() => buildOrgTree(flat)).toThrow(OrgTreeBuildError)
  })

  it('throws on an unknown parentId', () => {
    const flat: OrgNodeDto[] = [node({ id: 'a', parentId: 'ghost' })]

    expect(() => buildOrgTree(flat)).toThrow(OrgTreeBuildError)
  })

  it('throws on a self-cycle', () => {
    const flat: OrgNodeDto[] = [node({ id: 'a', parentId: 'a' })]

    expect(() => buildOrgTree(flat)).toThrow(/cycle/i)
  })

  it('throws on a mutual cycle disconnected from any root', () => {
    const flat: OrgNodeDto[] = [
      node({ id: 'root', parentId: null }),
      node({ id: 'a', parentId: 'b' }),
      node({ id: 'b', parentId: 'a' }),
    ]

    expect(() => buildOrgTree(flat)).toThrow(/cycle/i)
  })
})
