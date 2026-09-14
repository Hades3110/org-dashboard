import type { OrgAggregateRow } from '@/entities/org/aggregate'

export type SortColumn = 'name' | 'level' | 'headcount' | 'budget' | 'performance'
export type SortDirection = 'asc' | 'desc'

const collator = new Intl.Collator('ru')

// A row with no headcount has no meaningful average, so it sorts after every
// row that does — in both ascending and descending order — rather than
// flipping to the top when the direction reverses.
function comparePerformance(a: number | null, b: number | null, sign: 1 | -1): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return sign * (a - b)
}

function compare(a: OrgAggregateRow, b: OrgAggregateRow, column: SortColumn, direction: SortDirection): number {
  const sign = direction === 'asc' ? 1 : -1

  switch (column) {
    case 'name':
      return sign * collator.compare(a.name, b.name)
    case 'level':
      return sign * (a.level - b.level)
    case 'headcount':
      return sign * (a.aggregate.headcountTotal - b.aggregate.headcountTotal)
    case 'budget':
      return sign * (a.aggregate.budgetTotal - b.aggregate.budgetTotal)
    case 'performance':
      return comparePerformance(a.avgPerformance, b.avgPerformance, sign)
  }
}

// Direction is folded into the comparator itself (rather than sorting
// ascending and reversing) so that equal keys keep their original relative
// order in both directions — Array.prototype.sort is stable, but reversing
// its output after the fact is not.
export function sortRows(rows: OrgAggregateRow[], column: SortColumn, direction: SortDirection): OrgAggregateRow[] {
  return [...rows].sort((a, b) => compare(a, b, column, direction))
}
