import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFreshHighlight } from './useFreshHighlight'

describe('useFreshHighlight', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is false for a null timestamp', () => {
    const { result } = renderHook(() => useFreshHighlight(null))

    expect(result.current).toBe(false)
  })

  it('is true immediately after a timestamp is set, then false once the duration elapses', () => {
    const { result, rerender } = renderHook(({ changedAt }) => useFreshHighlight(changedAt, 1500), {
      initialProps: { changedAt: null as number | null },
    })

    expect(result.current).toBe(false)

    rerender({ changedAt: 1000 })
    expect(result.current).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1499)
    })
    expect(result.current).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(false)
  })

  it('restarts the fade instead of piling up timers when changed again within the window', () => {
    const { result, rerender } = renderHook(({ changedAt }) => useFreshHighlight(changedAt, 1500), {
      initialProps: { changedAt: 1000 as number | null },
    })

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(true) // still fresh, only 1000ms of 1500ms elapsed

    rerender({ changedAt: 2000 }) // a second change within the window
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(true) // the old timer (which would have fired at 1500ms) was cleared

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toBe(false) // fades out 1500ms after the SECOND change, not the first
  })
})
