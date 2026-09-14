import { useEffect, useState } from 'react'

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting'

export type EventSourceLike = {
  close(): void
  onopen: (() => void) | null
  onerror: (() => void) | null
  onmessage: ((ev: { data: string }) => void) | null
}

export type EventSourceFactory = (url: string) => EventSourceLike

// A module-level function, not an inline arrow default — a default parameter
// expression is re-evaluated on every call, so an inline arrow here would be
// a fresh function identity every render, retriggering the effect below on
// every render regardless of how well the caller memoises everything else
// (CLAUDE.md §11's "effect re-running because of an unmemoised callback").
//
// A thin adapter, not a direct type-cast of `EventSource`: the browser's own
// handler signatures carry the full `Event`/`MessageEvent` shape, which is
// more than this hook needs — the adapter narrows to just what EventSourceLike
// declares, so callers (and tests, via the injected fake) only ever deal with
// the minimal shape.
function defaultCreateEventSource(url: string): EventSourceLike {
  const source = new EventSource(url)
  const adapter: EventSourceLike = {
    close: () => source.close(),
    onopen: null,
    onerror: null,
    onmessage: null,
  }
  source.onopen = () => adapter.onopen?.()
  source.onerror = () => adapter.onerror?.()
  source.onmessage = (event) => adapter.onmessage?.({ data: event.data })
  return adapter
}

const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30000
const JITTER_RATIO = 0.2

// Cap first, then jitter the capped value — keeps the true ceiling at
// MAX_DELAY_MS * (1 + JITTER_RATIO), not uncapped-then-jittered-past-30s.
function backoffDelay(attempt: number): number {
  const capped = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt)
  const jitter = 1 + (Math.random() * 2 - 1) * JITTER_RATIO
  return Math.round(capped * jitter)
}

/**
 * A generic SSE connection with hand-rolled exponential backoff, deliberately
 * NOT relying on EventSource's own built-in reconnect: on every error the
 * current connection is closed explicitly and a fresh one is opened after a
 * `setTimeout` delay we control — so `status`/`retryDelayMs` always reflect
 * the real state instead of the browser's opaque internal retry loop.
 *
 * `createEventSource` defaults to the real global EventSource but is
 * injectable — jsdom has no EventSource, so tests pass a fake factory.
 */
export function useSseConnection<T>(
  url: string,
  parse: (raw: string) => T | null,
  createEventSource: EventSourceFactory = defaultCreateEventSource,
): { status: ConnectionStatus; lastMessage: T | null; retryDelayMs: number | null } {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [lastMessage, setLastMessage] = useState<T | null>(null)
  const [retryDelayMs, setRetryDelayMs] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    let current: EventSourceLike | null = null
    let attempt = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined

    function connect() {
      const source = createEventSource(url)
      current = source

      source.onopen = () => {
        if (cancelled) return
        attempt = 0
        setStatus('open')
        setRetryDelayMs(null)
      }

      source.onmessage = (event) => {
        if (cancelled) return
        try {
          const parsed = parse(event.data)
          if (parsed !== null) setLastMessage(parsed)
        } catch (err) {
          console.error('useSseConnection: failed to parse message', err)
        }
      }

      source.onerror = () => {
        if (cancelled) return
        source.close() // explicit — the whole point of not using the built-in retry
        setStatus('reconnecting')
        const delay = backoffDelay(attempt)
        attempt += 1
        setRetryDelayMs(delay)
        reconnectTimer = setTimeout(() => {
          if (!cancelled) connect()
        }, delay)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      current?.close()
    }
  }, [url, parse, createEventSource])

  return { status, lastMessage, retryDelayMs }
}
