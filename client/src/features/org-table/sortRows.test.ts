import { describe, expect, it } from 'vitest'
import type { OrgAggregateRow } from '@/entities/org/aggregate'
import { sortRows } from './sortRows'

function row(overrides: Partial<OrgAggregateRow> & Pick<OrgAggregateRow, 'id'>): OrgAggregateRow {
  return {
    name: overrides.id,
    parentId: null,
    level: 1,
    ancestors: [],
    aggregate: { headcountTotal: 0, budgetTotal: 0, weightedPerf: 0 },
    avgPerformance: null,
    ...overrides,
  }
}

describe('sortRows', () => {
  it('sorts ascending and descending by a numeric column', () => {
    const rows = [
      row({ id: 'a', aggregate: { headcountTotal: 30, budgetTotal: 0, weightedPerf: 0 } }),
      row({ id: 'b', aggregate: { headcountTotal: 10, budgetTotal: 0, weightedPerf: 0 } }),
      row({ id: 'c', aggregate: { headcountTotal: 20, budgetTotal: 0, weightedPerf: 0 } }),
    ]

    expect(sortRows(rows, 'headcount', 'asc').map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(sortRows(rows, 'headcount', 'desc').map((r) => r.id)).toEqual(['a', 'c', 'b'])
  })

  it('sorts by name using locale-aware comparison', () => {
    const rows = [row({ id: 'b', name: 'Бета' }), row({ id: 'a', name: 'Альфа' })]

    expect(sortRows(rows, 'name', 'asc').map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('keeps rows with no average performance last in both directions', () => {
    const rows = [row({ id: 'no-avg', avgPerformance: null }), row({ id: 'low', avgPerformance: 20 }), row({ id: 'high', avgPerformance: 80 })]

    expect(sortRows(rows, 'performance', 'asc').map((r) => r.id)).toEqual(['low', 'high', 'no-avg'])
    expect(sortRows(rows, 'performance', 'desc').map((r) => r.id)).toEqual(['high', 'low', 'no-avg'])
  })

  it('is stable: rows with equal keys keep their original relative order in both directions', () => {
    const rows = [
      row({ id: 'first', aggregate: { headcountTotal: 10, budgetTotal: 0, weightedPerf: 0 } }),
      row({ id: 'second', aggregate: { headcountTotal: 10, budgetTotal: 0, weightedPerf: 0 } }),
    ]

    expect(sortRows(rows, 'headcount', 'asc').map((r) => r.id)).toEqual(['first', 'second'])
    expect(sortRows(rows, 'headcount', 'desc').map((r) => r.id)).toEqual(['first', 'second'])
  })

  it('does not mutate the input array', () => {
    const rows = [row({ id: 'b' }), row({ id: 'a' })]
    const original = [...rows]

    sortRows(rows, 'name', 'asc')

    expect(rows).toEqual(original)
  })
})
