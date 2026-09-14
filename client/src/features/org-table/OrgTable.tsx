import { useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type { OrgAggregateRow } from '@/entities/org/aggregate'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { EmptyState } from '@/shared/ui/EmptyState'
import { filterRowsByName } from './filterRowsByName'
import { FilterInput, Table, TableScroll, TableWrapper, Tbody, Th, Thead } from './OrgTable.styles'
import { sortRows, type SortColumn } from './sortRows'
import { TableRow } from './TableRow'
import { useSortState } from './useSortState'

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'name', label: 'Подразделение' },
  { key: 'level', label: 'Уровень' },
  { key: 'headcount', label: 'Всего сотрудников' },
  { key: 'budget', label: 'Бюджет суммарный' },
  { key: 'performance', label: 'Средняя эффективность' },
]

export function OrgTable({
  rows,
  selectedId,
  onRowClick,
}: {
  rows: OrgAggregateRow[]
  selectedId: string | null
  onRowClick: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 250)
  const { sort, handleHeaderClick, handleHeaderDoubleClick } = useSortState()

  const visibleRows = useMemo(() => {
    const filtered = filterRowsByName(rows, debouncedQuery)
    return sortRows(filtered, sort.column, sort.direction)
  }, [rows, debouncedQuery, sort])

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)

  return (
    <TableWrapper>
      <FilterInput
        type="search"
        placeholder="Фильтр по названию…"
        aria-label="Фильтр по названию подразделения"
        value={query}
        onChange={handleQueryChange}
      />
      <TableScroll>
        <Table>
          <Thead>
            <tr>
              {COLUMNS.map((column) => (
                <HeaderCell
                  key={column.key}
                  column={column}
                  sort={sort}
                  onHeaderClick={handleHeaderClick}
                  onHeaderDoubleClick={handleHeaderDoubleClick}
                />
              ))}
            </tr>
          </Thead>
          <Tbody>
            {visibleRows.map((row) => (
              <TableRow key={row.id} row={row} isSelected={row.id === selectedId} onSelect={onRowClick} />
            ))}
          </Tbody>
        </Table>
      </TableScroll>
      {visibleRows.length === 0 && <EmptyState message="Ничего не найдено." />}
    </TableWrapper>
  )
}

function HeaderCell({
  column,
  sort,
  onHeaderClick,
  onHeaderDoubleClick,
}: {
  column: { key: SortColumn; label: string }
  sort: { column: SortColumn; direction: 'asc' | 'desc' }
  onHeaderClick: (column: SortColumn) => void
  onHeaderDoubleClick: (column: SortColumn) => void
}) {
  const active = sort.column === column.key
  const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'

  const handleKeyDown = (event: KeyboardEvent<HTMLTableCellElement>) => {
    // Full arrow-key navigation across headers is step/3 scope; Enter/Space
    // give the header a baseline keyboard equivalent of a single click now.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onHeaderClick(column.key)
    }
  }

  return (
    <Th
      tabIndex={0}
      aria-sort={ariaSort}
      onClick={() => onHeaderClick(column.key)}
      onDoubleClick={() => onHeaderDoubleClick(column.key)}
      onKeyDown={handleKeyDown}
    >
      {column.label}
      {active && <span aria-hidden="true">{sort.direction === 'asc' ? ' ▲' : ' ▼'}</span>}
    </Th>
  )
}
