import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSortState } from './useSortState'

describe('useSortState', () => {
  it('a single click on a new column sorts it ascending', () => {
    const { result } = renderHook(() => useSortState())

    act(() => result.current.handleHeaderClick('budget'))

    expect(result.current.sort).toEqual({ column: 'budget', direction: 'asc' })
  })

  it('two independent single clicks on the same column do not cancel each other out', () => {
    const { result } = renderHook(() => useSortState())

    act(() => result.current.handleHeaderClick('budget'))
    act(() => result.current.handleHeaderClick('budget'))

    expect(result.current.sort).toEqual({ column: 'budget', direction: 'asc' })
  })

  it('a real double click (click, click, dblclick) nets to descending on a fresh column', () => {
    const { result } = renderHook(() => useSortState())

    act(() => {
      result.current.handleHeaderClick('budget')
      result.current.handleHeaderClick('budget')
      result.current.handleHeaderDoubleClick('budget')
    })

    expect(result.current.sort).toEqual({ column: 'budget', direction: 'desc' })
  })

  it('double-clicking the active column flips direction, and flips back on a second double click', () => {
    const { result } = renderHook(() => useSortState())

    act(() => result.current.handleHeaderDoubleClick('headcount'))
    expect(result.current.sort).toEqual({ column: 'headcount', direction: 'desc' })

    act(() => result.current.handleHeaderDoubleClick('headcount'))
    expect(result.current.sort).toEqual({ column: 'headcount', direction: 'asc' })
  })
})
