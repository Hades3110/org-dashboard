import { useMemo, type KeyboardEvent } from 'react'
import type { OrgAggregateRow } from '@/entities/org/aggregate'
import type { Freshness } from '@/entities/org/patch'
import { useRovingIndex } from '@/shared/hooks/useRovingIndex'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Table, TableScroll, TableWrapper, Tbody, Th, Thead } from './OrgTable.styles'
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
  freshness,
}: {
  rows: OrgAggregateRow[]
  selectedId: string | null
  onRowClick: (id: string) => void
  freshness: Freshness
}) {
  const { sort, handleHeaderClick, handleHeaderDoubleClick } = useSortState()

  // `rows` arrives already filtered (plain-text or AI-narrowed — see
  // app/useAiSearch.ts); this component's only remaining job is sorting.
  const visibleRows = useMemo(() => sortRows(rows, sort.column, sort.direction), [rows, sort])

  // Two independent roving-tabindex groups: headers and rows. Collapses what
  // used to be ~75 individual Tab stops (5 headers + one per row) down to 2.
  const headerRoving = useRovingIndex(COLUMNS.length, 'horizontal')
  const rowRoving = useRovingIndex(visibleRows.length, 'vertical')

  return (
    <TableWrapper>
      <TableScroll>
        <Table>
          <Thead>
            <tr>
              {COLUMNS.map((column, index) => (
                <HeaderCell
                  key={column.key}
                  column={column}
                  index={index}
                  sort={sort}
                  onHeaderClick={handleHeaderClick}
                  onHeaderDoubleClick={handleHeaderDoubleClick}
                  tabIndex={headerRoving.tabIndex(index)}
                  registerItem={headerRoving.registerItem(index)}
                  onRovingKeyDown={headerRoving.handleKeyDown}
                />
              ))}
            </tr>
          </Thead>
          <Tbody>
            {visibleRows.map((row, index) => (
              <TableRow
                key={row.id}
                row={row}
                index={index}
                isSelected={row.id === selectedId}
                onSelect={onRowClick}
                freshness={freshness}
                tabIndex={rowRoving.tabIndex(index)}
                registerItem={rowRoving.registerItem(index)}
                onRovingKeyDown={rowRoving.handleKeyDown}
              />
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
  index,
  sort,
  onHeaderClick,
  onHeaderDoubleClick,
  tabIndex,
  registerItem,
  onRovingKeyDown,
}: {
  column: { key: SortColumn; label: string }
  index: number
  sort: { column: SortColumn; direction: 'asc' | 'desc' }
  onHeaderClick: (column: SortColumn) => void
  onHeaderDoubleClick: (column: SortColumn) => void
  tabIndex: number
  registerItem: (el: HTMLElement | null) => void
  onRovingKeyDown: (event: KeyboardEvent, index: number) => void
}) {
  const active = sort.column === column.key
  const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'

  const handleKeyDown = (event: KeyboardEvent<HTMLTableCellElement>) => {
    onRovingKeyDown(event, index)
    // Enter/Space is this call site's own concern (sorts ascending on a new
    // column, no-ops on the active one) — arrow/Home/End movement is the
    // only part shared with the row group, hence useRovingIndex not handling it.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onHeaderClick(column.key)
    }
  }

  return (
    <Th
      ref={registerItem}
      tabIndex={tabIndex}
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
