import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrgAggregateRow } from '@/entities/org/aggregate'
import { useAiSearch } from './useAiSearch'

function row(overrides: Partial<OrgAggregateRow> & Pick<OrgAggregateRow, 'id'>): OrgAggregateRow {
  return {
    name: overrides.id,
    parentId: null,
    level: 1,
    ancestors: [],
    aggregate: { headcountTotal: 10, budgetTotal: 1000, weightedPerf: 500 },
    avgPerformance: 50,
    ...overrides,
  }
}

function fakeResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

async function advanceDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(400)
    await Promise.resolve()
  })
}

describe('useAiSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts idle with the full row set for an empty query', () => {
    const rows = [row({ id: 'a' }), row({ id: 'b' })]
    const { result } = renderHook(() => useAiSearch(rows))

    expect(result.current.status).toBe('idle')
    expect(result.current.visibleRows).toBe(rows)
  })

  it('applies the AI-resolved structured filter once it resolves', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(200, { filter: { level: 2 } }))
    const rows = [row({ id: 'root', level: 1 }), row({ id: 'child', level: 2 })]
    const { result } = renderHook(() => useAiSearch(rows, fetchImpl))

    act(() => result.current.setQuery('уровень 2'))
    await advanceDebounce()

    expect(fetchImpl).toHaveBeenCalledWith('/api/ai-search', expect.objectContaining({ method: 'POST' }))
    expect(result.current.status).toBe('ai')
    expect(result.current.visibleRows.map((r) => r.id)).toEqual(['child'])
  })

  it('falls back to plain text filtering on a non-2xx response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(503, { error: 'not configured' }))
    const rows = [row({ id: 'Технологии' }), row({ id: 'Продажи' })]
    const { result } = renderHook(() => useAiSearch(rows, fetchImpl))

    act(() => result.current.setQuery('технолог'))
    await advanceDebounce()

    expect(result.current.status).toBe('fallback')
    expect(result.current.visibleRows.map((r) => r.id)).toEqual(['Технологии'])
  })

  it('falls back to plain text filtering when the response body is not a valid filter', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(200, { filter: { level: 'two' } }))
    const rows = [row({ id: 'Технологии' }), row({ id: 'Продажи' })]
    const { result } = renderHook(() => useAiSearch(rows, fetchImpl))

    act(() => result.current.setQuery('технолог'))
    await advanceDebounce()

    expect(result.current.status).toBe('fallback')
    expect(result.current.visibleRows.map((r) => r.id)).toEqual(['Технологии'])
  })

  it('ignores a superseded response when a newer query has already resolved', async () => {
    const first = deferred<ReturnType<typeof fakeResponse>>()
    const second = deferred<ReturnType<typeof fakeResponse>>()
    const fetchImpl = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const rows = [row({ id: 'root', level: 1 }), row({ id: 'child', level: 2 })]
    const { result } = renderHook(() => useAiSearch(rows, fetchImpl))

    act(() => result.current.setQuery('первый запрос'))
    await advanceDebounce()
    act(() => result.current.setQuery('второй запрос'))
    await advanceDebounce()

    expect(fetchImpl).toHaveBeenCalledTimes(2)

    await act(async () => {
      second.resolve(fakeResponse(200, { filter: { level: 2 } }))
      await Promise.resolve()
    })
    expect(result.current.status).toBe('ai')
    expect(result.current.visibleRows.map((r) => r.id)).toEqual(['child'])

    // The first request's promise resolves late, after being superseded —
    // must not clobber the second (already-applied) result.
    await act(async () => {
      first.resolve(fakeResponse(200, { filter: { level: 1 } }))
      await Promise.resolve()
    })
    expect(result.current.status).toBe('ai')
    expect(result.current.visibleRows.map((r) => r.id)).toEqual(['child'])
  })
})
