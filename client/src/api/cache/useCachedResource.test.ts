import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCachedResource, type CachedFetchResult } from './useCachedResource'

type Step = () => CachedFetchResult<string[]> | Promise<CachedFetchResult<string[]>>

function makeFetcher(steps: Step[]) {
  let call = 0
  return vi.fn(async () => {
    const step = steps[Math.min(call, steps.length - 1)]
    call += 1
    if (!step) throw new Error('makeFetcher: no step configured')
    return step()
  })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('useCachedResource', () => {
  it('serves fresh data synchronously and does not refetch while fresh', async () => {
    const fetcher = makeFetcher([() => ({ status: 'ok', data: ['a'], etag: 'v1' })])

    const first = renderHook(() => useCachedResource('fresh-key', fetcher, { staleTime: 10_000 }))
    await waitFor(() => expect(first.result.current.status).toBe('success'))
    expect(fetcher).toHaveBeenCalledTimes(1)

    // A second subscriber to the same key, still within staleTime: served from
    // cache, no additional network call.
    const second = renderHook(() => useCachedResource('fresh-key', fetcher, { staleTime: 10_000 }))
    expect(second.result.current.data).toEqual(['a'])
    expect(fetcher).toHaveBeenCalledTimes(1)

    first.unmount()
    second.unmount()
  })

  it('shares one in-flight request between concurrent subscribers', async () => {
    let resolveFetch: (value: CachedFetchResult<string[]>) => void = () => {}
    const fetcher = vi.fn(
      () =>
        new Promise<CachedFetchResult<string[]>>((resolve) => {
          resolveFetch = resolve
        }),
    )

    const first = renderHook(() => useCachedResource('concurrent-key', fetcher, { staleTime: 10_000 }))
    const second = renderHook(() => useCachedResource('concurrent-key', fetcher, { staleTime: 10_000 }))

    expect(fetcher).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFetch({ status: 'ok', data: ['x'], etag: null })
      await Promise.resolve()
    })

    expect(first.result.current.data).toEqual(['x'])
    expect(second.result.current.data).toEqual(['x'])

    first.unmount()
    second.unmount()
  })

  it('serves stale data immediately, revalidates in the background, and a 304 triggers no re-render', async () => {
    const dataV1 = ['a', 'b']
    const fetcher = makeFetcher([() => ({ status: 'ok', data: dataV1, etag: 'v1' }), () => ({ status: 'not-modified' })])

    let renderCount = 0
    const first = renderHook(() => {
      renderCount++
      return useCachedResource('stale-key', fetcher, { staleTime: 5 })
    })

    await waitFor(() => expect(first.result.current.status).toBe('success'))
    const dataRef = first.result.current.data
    const renderCountAfterLoad = renderCount

    await sleep(10) // let staleTime elapse

    // A second subscriber triggers the SWR background revalidation, but sees
    // the stale data immediately (same object reference) rather than a spinner.
    const second = renderHook(() => useCachedResource('stale-key', fetcher, { staleTime: 5 }))
    expect(second.result.current.data).toBe(dataRef)
    expect(second.result.current.isStale).toBe(true)

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    await act(async () => {
      await Promise.resolve()
    })

    expect(first.result.current.data).toBe(dataRef) // identity preserved across the 304
    expect(renderCount).toBe(renderCountAfterLoad) // the 304 caused zero re-renders

    first.unmount()
    second.unmount()
  })

  it('does not surface an aborted request as an error', async () => {
    let capturedSignal: AbortSignal | undefined
    const fetcher = vi.fn((context: { signal: AbortSignal; etag: string | null }) => {
      capturedSignal = context.signal
      return new Promise<CachedFetchResult<string[]>>((_resolve, reject) => {
        context.signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    })

    const { result, unmount } = renderHook(() => useCachedResource('abort-key', fetcher, { staleTime: 10_000 }))
    expect(result.current.status).toBe('loading')

    unmount()
    await act(async () => {
      await Promise.resolve()
    })

    expect(capturedSignal?.aborted).toBe(true)
    expect(result.current.status).toBe('loading') // never flipped to 'error'
  })
})
