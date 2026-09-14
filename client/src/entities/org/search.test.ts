import { describe, expect, it } from 'vitest'
import type { OrgAggregateRow } from './aggregate'
import { applyStructuredFilter } from './search'

function row(overrides: Partial<OrgAggregateRow> & Pick<OrgAggregateRow, 'id'>): OrgAggregateRow {
  return {
    name: overrides.id,
    parentId: null,
    level: 1,
    ancestors: [],
    aggregate: { headcountTotal: 10, budgetTotal: 1000, weightedPerf: 500 },
    avgPerformance: 50,
    ...overrides,
  }
}

describe('applyStructuredFilter', () => {
  it('returns the same array reference for an empty filter', () => {
    const rows = [row({ id: 'a' })]

    expect(applyStructuredFilter(rows, {})).toBe(rows)
  })

  it('filters by nameContains, case-insensitively', () => {
    const rows = [row({ id: 'a', name: 'Технологии' }), row({ id: 'b', name: 'Продажи' })]

    expect(applyStructuredFilter(rows, { nameContains: 'технолог' }).map((r) => r.id)).toEqual(['a'])
  })

  it('filters by headcount range', () => {
    const rows = [
      row({ id: 'small', aggregate: { headcountTotal: 5, budgetTotal: 0, weightedPerf: 0 } }),
      row({ id: 'big', aggregate: { headcountTotal: 50, budgetTotal: 0, weightedPerf: 0 } }),
    ]

    expect(applyStructuredFilter(rows, { minHeadcount: 10 }).map((r) => r.id)).toEqual(['big'])
    expect(applyStructuredFilter(rows, { maxHeadcount: 10 }).map((r) => r.id)).toEqual(['small'])
  })

  it('filters by budget range', () => {
    const rows = [
      row({ id: 'cheap', aggregate: { headcountTotal: 0, budgetTotal: 1000, weightedPerf: 0 } }),
      row({ id: 'expensive', aggregate: { headcountTotal: 0, budgetTotal: 1_000_000, weightedPerf: 0 } }),
    ]

    expect(applyStructuredFilter(rows, { minBudget: 10_000 }).map((r) => r.id)).toEqual(['expensive'])
    expect(applyStructuredFilter(rows, { maxBudget: 10_000 }).map((r) => r.id)).toEqual(['cheap'])
  })

  it('filters by performance range, excluding rows with no data', () => {
    const rows = [
      row({ id: 'low', avgPerformance: 20 }),
      row({ id: 'high', avgPerformance: 90 }),
      row({ id: 'empty', avgPerformance: null, aggregate: { headcountTotal: 0, budgetTotal: 0, weightedPerf: 0 } }),
    ]

    expect(applyStructuredFilter(rows, { minPerformance: 50 }).map((r) => r.id)).toEqual(['high'])
    expect(applyStructuredFilter(rows, { maxPerformance: 50 }).map((r) => r.id)).toEqual(['low'])
  })

  it('filters by level', () => {
    const rows = [row({ id: 'root', level: 1 }), row({ id: 'child', level: 2 })]

    expect(applyStructuredFilter(rows, { level: 2 }).map((r) => r.id)).toEqual(['child'])
  })

  it('combines constraints with AND', () => {
    const rows = [
      row({ id: 'a', name: 'Технологии', avgPerformance: 90 }),
      row({ id: 'b', name: 'Технологии', avgPerformance: 20 }),
      row({ id: 'c', name: 'Продажи', avgPerformance: 90 }),
    ]

    expect(applyStructuredFilter(rows, { nameContains: 'технолог', minPerformance: 50 }).map((r) => r.id)).toEqual(['a'])
  })
})
