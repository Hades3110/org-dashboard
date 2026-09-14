import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSseConnection, type EventSourceFactory, type EventSourceLike } from './useSseConnection'

class FakeEventSource implements EventSourceLike {
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  close = vi.fn()
}

function makeFactory() {
  const instances: FakeEventSource[] = []
  const factory: EventSourceFactory = () => {
    const instance = new FakeEventSource()
    instances.push(instance)
    return instance
  }
  return { factory, instances }
}

const parseString = (raw: string) => raw

describe('useSseConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // 0.5 -> jitter multiplier of exactly 1 (no jitter), for deterministic delays
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts connecting, then reports open once the connection opens', () => {
    const { factory, instances } = makeFactory()
    const { result } = renderHook(() => useSseConnection('/stream', parseString, factory))

    expect(result.current.status).toBe('connecting')

    act(() => instances[0]?.onopen?.())

    expect(result.current.status).toBe('open')
    expect(result.current.retryDelayMs).toBeNull()
  })

  it('parses incoming messages into lastMessage', () => {
    const { factory, instances } = makeFactory()
    const { result } = renderHook(() => useSseConnection('/stream', parseString, factory))

    act(() => instances[0]?.onmessage?.({ data: 'hello' }))

    expect(result.current.lastMessage).toBe('hello')
  })

  it('drops a message the parser rejects, without throwing or updating lastMessage', () => {
    const { factory, instances } = makeFactory()
    const parse = (raw: string) => (raw === 'good' ? raw : null)
    const { result } = renderHook(() => useSseConnection('/stream', parse, factory))

    expect(() => act(() => instances[0]?.onmessage?.({ data: 'bad' }))).not.toThrow()
    expect(result.current.lastMessage).toBeNull()
  })

  it('closes the connection itself on error instead of relying on the built-in retry', () => {
    const { factory, instances } = makeFactory()
    const { result } = renderHook(() => useSseConnection('/stream', parseString, factory))

    act(() => instances[0]?.onerror?.())

    expect(instances[0]?.close).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('reconnecting')
  })

  it('backs off exponentially across successive failures', () => {
    const { factory, instances } = makeFactory()
    const { result } = renderHook(() => useSseConnection('/stream', parseString, factory))

    act(() => instances[0]?.onerror?.())
    expect(result.current.retryDelayMs).toBe(1000)

    act(() => vi.advanceTimersByTime(1000))
    expect(instances).toHaveLength(2) // reconnect attempt made

    act(() => instances[1]?.onerror?.())
    expect(result.current.retryDelayMs).toBe(2000)

    act(() => vi.advanceTimersByTime(2000))
    expect(instances).toHaveLength(3)

    act(() => instances[2]?.onerror?.())
    expect(result.current.retryDelayMs).toBe(4000)
  })

  it('caps the backoff delay at 30s', () => {
    const { factory, instances } = makeFactory()
    const { result } = renderHook(() => useSseConnection('/stream', parseString, factory))

    // 1000 * 2^attempt exceeds 30000 once attempt reaches 5 (32000) — drive
    // past that and confirm the delay stops growing.
    for (let i = 0; i < 6; i++) {
      act(() => instances[i]?.onerror?.())
      act(() => vi.advanceTimersByTime(result.current.retryDelayMs ?? 0))
    }
    act(() => instances[6]?.onerror?.())

    expect(result.current.retryDelayMs).toBe(30000)
  })

  it('resets the backoff attempt counter after a successful reconnect', () => {
    const { factory, instances } = makeFactory()
    const { result } = renderHook(() => useSseConnection('/stream', parseString, factory))

    act(() => instances[0]?.onerror?.())
    act(() => vi.advanceTimersByTime(1000))
    act(() => instances[1]?.onopen?.())
    expect(result.current.status).toBe('open')

    act(() => instances[1]?.onerror?.())
    expect(result.current.retryDelayMs).toBe(1000) // back to the base delay, not 2000
  })

  it('clears the pending reconnect timer and closes the connection on unmount', () => {
    const { factory, instances } = makeFactory()
    const { unmount } = renderHook(() => useSseConnection('/stream', parseString, factory))

    act(() => instances[0]?.onerror?.())
    unmount()

    act(() => vi.advanceTimersByTime(5000))

    expect(instances).toHaveLength(1) // no reconnect attempted after unmount
    expect(instances[0]?.close).toHaveBeenCalled()
  })
})
