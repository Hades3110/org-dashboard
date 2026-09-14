import type { KeyboardEvent } from 'react'
import type { OrgAggregateRow } from '@/entities/org/aggregate'
import { formatBudget, formatHeadcount } from '@/shared/formatters/format'
import { PerformanceIndicator } from '@/shared/ui/PerformanceIndicator'
import { NameCell, PathBreadcrumb, Td, Tr } from './OrgTable.styles'

export function TableRow({
  row,
  isSelected,
  onSelect,
}: {
  row: OrgAggregateRow
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const path = row.ancestors.map((ancestor) => ancestor.name).join(' / ')

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === 'Enter') onSelect(row.id)
  }

  return (
    <Tr $selected={isSelected} tabIndex={0} aria-selected={isSelected} onClick={() => onSelect(row.id)} onKeyDown={handleKeyDown}>
      <Td>
        <NameCell title={row.name}>{row.name}</NameCell>
        {/* Kept visible even when a name filter narrows the table down to just
            this row, so a match never loses the context of where it sits in
            the hierarchy — CLAUDE.md §11. */}
        {path !== '' && <PathBreadcrumb title={path}>{path}</PathBreadcrumb>}
      </Td>
      <Td>{row.level}</Td>
      <Td>{formatHeadcount(row.aggregate.headcountTotal)}</Td>
      <Td>{formatBudget(row.aggregate.budgetTotal)}</Td>
      <Td>
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
