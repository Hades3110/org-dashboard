import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFreshHighlight } from './useFreshHighlight'

const EPOCH = new Date('2026-01-01T00:00:00.000Z').getTime()

describe('useFreshHighlight', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(EPOCH)
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

    rerender({ changedAt: Date.now() })
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
      initialProps: { changedAt: Date.now() as number | null },
    })

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(true) // still fresh, only 1000ms of 1500ms elapsed

    rerender({ changedAt: Date.now() }) // a second change within the window
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(true) // the old timer (which would have fired at 1500ms) was cleared

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toBe(false) // fades out 1500ms after the SECOND change, not the first
  })

  it('is not fresh on mount for a timestamp already outside the window', () => {
    // Simulates a table row remounting (e.g. an AI-search filter that hid it
    // is cleared) long after its last real SSE update — freshness entries
    // are never pruned, so this must be judged by age, not just non-null.
    const staleChangedAt = Date.now() - 5000
    const { result } = renderHook(() => useFreshHighlight(staleChangedAt, 1500))

    expect(result.current).toBe(false)
  })

  it('is fresh on mount for a timestamp still within the window, and fades after the REMAINING time', () => {
    // Mounting 500ms after the real change (e.g. initial load shortly after
    // a patch) should honor the original 1500ms window, not restart it.
    const recentChangedAt = Date.now() - 500
    const { result } = renderHook(() => useFreshHighlight(recentChangedAt, 1500))

    expect(result.current).toBe(true)

    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(result.current).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(false)
  })
})
