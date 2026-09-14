import type { OrgAggregateRow } from '@/entities/org/aggregate'

// Empty query returns the same array reference — keeps the downstream sort
// memo from re-running when there's nothing to filter.
export function filterRowsByName(rows: OrgAggregateRow[], query: string): OrgAggregateRow[] {
  const normalized = query.trim().toLowerCase()
  if (normalized === '') return rows

  return rows.filter((row) => row.name.toLowerCase().includes(normalized))
}
