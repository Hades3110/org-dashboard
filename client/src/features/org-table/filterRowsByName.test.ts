import { describe, expect, it } from 'vitest'
import type { OrgAggregateRow } from '@/entities/org/aggregate'
import { filterRowsByName } from './filterRowsByName'

function row(id: string, name: string): OrgAggregateRow {
  return {
    id,
    name,
    parentId: null,
    level: 1,
    ancestors: [],
    aggregate: { headcountTotal: 0, budgetTotal: 0, weightedPerf: 0 },
    avgPerformance: null,
  }
}

describe('filterRowsByName', () => {
  it('matches case-insensitively as a substring', () => {
    const rows = [row('a', 'Технологии'), row('b', 'Продажи')]

    expect(filterRowsByName(rows, 'технолог').map((r) => r.id)).toEqual(['a'])
    expect(filterRowsByName(rows, 'ТЕХНОЛОГ').map((r) => r.id)).toEqual(['a'])
  })

  it('returns the same array reference for an empty or blank query', () => {
    const rows = [row('a', 'Технологии')]

    expect(filterRowsByName(rows, '')).toBe(rows)
    expect(filterRowsByName(rows, '   ')).toBe(rows)
  })

  it('returns an empty array when nothing matches', () => {
    const rows = [row('a', 'Технологии')]

    expect(filterRowsByName(rows, 'zzz')).toEqual([])
  })
})
