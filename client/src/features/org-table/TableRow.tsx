import type { KeyboardEvent } from 'react'
import type { OrgAggregateRow } from '@/entities/org/aggregate'
import type { Freshness } from '@/entities/org/patch'
import { formatBudget, formatHeadcount } from '@/shared/formatters/format'
import { useFreshHighlight } from '@/shared/hooks/useFreshHighlight'
import { PerformanceIndicator } from '@/shared/ui/PerformanceIndicator'
import { NameCell, PathBreadcrumb, Td, Tr } from './OrgTable.styles'

export function TableRow({
  row,
  index,
  isSelected,
  onSelect,
  freshness,
  tabIndex,
  registerItem,
  onRovingKeyDown,
}: {
  row: OrgAggregateRow
  index: number
  isSelected: boolean
  onSelect: (id: string) => void
  freshness: Freshness
  tabIndex: number
  registerItem: (el: HTMLElement | null) => void
  onRovingKeyDown: (event: KeyboardEvent, index: number) => void
}) {
  const path = row.ancestors.map((ancestor) => ancestor.name).join(' / ')

  const fields = freshness.get(row.id)
  const headcountFresh = useFreshHighlight(fields?.headcount ?? null)
  const budgetFresh = useFreshHighlight(fields?.budget ?? null)
  const performanceFresh = useFreshHighlight(fields?.performance ?? null)

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    onRovingKeyDown(event, index)
    if (event.key === 'Enter') onSelect(row.id)
  }

  return (
    <Tr
      ref={registerItem}
      $selected={isSelected}
      tabIndex={tabIndex}
      aria-selected={isSelected}
      onClick={() => onSelect(row.id)}
      onKeyDown={handleKeyDown}
    >
      <Td>
        <NameCell title={row.name}>{row.name}</NameCell>
        {/* Kept visible even when a name filter narrows the table down to just
            this row, so a match never loses the context of where it sits in
            the hierarchy — CLAUDE.md §11. */}
        {path !== '' && <PathBreadcrumb title={path}>{path}</PathBreadcrumb>}
      </Td>
      <Td>{row.level}</Td>
      <Td $isFresh={headcountFresh}>{formatHeadcount(row.aggregate.headcountTotal)}</Td>
      <Td $isFresh={budgetFresh}>{formatBudget(row.aggregate.budgetTotal)}</Td>
      <Td $isFresh={performanceFresh}>
        {row.avgPerformance === null ? (
          <span aria-label="Средняя эффективность: нет данных">—</span>
        ) : (
          <PerformanceIndicator
            value={row.avgPerformance}
            ariaLabel={`Средняя эффективность: ${Math.round(row.avgPerformance)} из 100`}
          />
        )}
      </Td>
    </Tr>
  )
}
