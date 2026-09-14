import { useCallback, useState } from 'react'
import type { SortColumn, SortDirection } from './sortRows'

export type SortState = { column: SortColumn; direction: SortDirection }

const DEFAULT_SORT: SortState = { column: 'name', direction: 'asc' }

function flip(direction: SortDirection): SortDirection {
  return direction === 'asc' ? 'desc' : 'asc'
}

export function useSortState() {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)

  // A single click is idempotent on the already-active column — it only ever
  // switches to a new one (always ascending). If a click instead toggled
  // direction, a real double-click's own two `click` events (browsers fire
  // click, click, dblclick) would cancel each other out before `dblclick` got
  // a chance to act — see CLAUDE.md §11.
  const handleHeaderClick = useCallback((column: SortColumn) => {
    setSort((prev) => (prev.column === column ? prev : { column, direction: 'asc' }))
  }, [])

  // The deliberate reversal lives here instead: a new column starts
  // descending, and the already-active column flips.
  const handleHeaderDoubleClick = useCallback((column: SortColumn) => {
    setSort((prev) => ({
      column,
      direction: prev.column === column ? flip(prev.direction) : 'desc',
    }))
  }, [])

  return { sort, handleHeaderClick, handleHeaderDoubleClick }
}
