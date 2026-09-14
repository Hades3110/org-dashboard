import { useCallback, useSyncExternalStore } from 'react'

export type CacheStatus = 'loading' | 'success' | 'error' | 'empty'

export type CachedFetchResult<T> = { status: 'ok'; data: T; etag: string | null } | { status: 'not-modified' }

export type CachedFetcher<T> = (context: { signal: AbortSignal; etag: string | null }) => Promise<CachedFetchResult<T>>

export type CachedResourceState<T> = {
  data: T | undefined
  status: CacheStatus
  error: Error | undefined
  isStale: boolean
  refetch: () => void
}

type PublicSnapshot<T> = {
  data: T | undefined
  status: CacheStatus
  error: Error | undefined
}

type CacheEntry<T> = {
  updatedAt: number
  etag: string | null
  inFlight: Promise<void> | null
  abortController: AbortController | null
  listeners: Set<() => void>
  snapshot: PublicSnapshot<T>
}

// Module-level, so every component subscribing to the same key shares one
// entry, one in-flight request, and one cached object reference.
const store = new Map<string, CacheEntry<unknown>>()

function getOrCreateEntry<T>(key: string): CacheEntry<T> {
  const existing = store.get(key)
  if (existing) return existing as CacheEntry<T>

  const entry: CacheEntry<T> = {
    updatedAt: 0,
    etag: null,
    inFlight: null,
    abortController: null,
    listeners: new Set(),
    snapshot: { data: undefined, status: 'loading', error: undefined },
  }
  store.set(key, entry as CacheEntry<unknown>)
  return entry
}

function notify<T>(entry: CacheEntry<T>): void {
  for (const listener of entry.listeners) listener()
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException) return err.name === 'AbortError'
  return err instanceof Error && err.name === 'AbortError'
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err))
}

function defaultIsEmpty<T>(data: T): boolean {
  return Array.isArray(data) && data.length === 0
}

function ensureFresh<T>(
  entry: CacheEntry<T>,
  fetcher: CachedFetcher<T>,
  staleTime: number,
  isEmpty: (data: T) => boolean,
): void {
  const age = entry.updatedAt === 0 ? Infinity : Date.now() - entry.updatedAt
  if (age < staleTime) return // fresh — served synchronously, no network call
  if (entry.inFlight) return // a fetch is already in flight — subscribers share it

  const controller = new AbortController()
  entry.abortController = controller

  entry.inFlight = fetcher({ signal: controller.signal, etag: entry.etag })
    .then((result) => {
      if (controller.signal.aborted) return
      entry.updatedAt = Date.now()

      if (result.status === 'not-modified') {
        // Real change only: the payload didn't change, so `snapshot.data` keeps
        // its existing object reference and we deliberately skip notify() —
        // no re-render, no re-aggregation downstream.
        return
      }

      entry.etag = result.etag
      entry.snapshot = {
        data: result.data,
        status: isEmpty(result.data) ? 'empty' : 'success',
        error: undefined,
      }
      notify(entry)
    })
    .catch((err: unknown) => {
      if (controller.signal.aborted || isAbortError(err)) return // not a failure
      entry.snapshot = { ...entry.snapshot, status: 'error', error: toError(err) }
      notify(entry)
    })
    .finally(() => {
      entry.inFlight = null
      entry.abortController = null

      // The request that just finished was aborted before it could settle,
      // yet someone is still subscribed and we still have no data — e.g. React
      // StrictMode's dev-only mount -> unmount -> remount, which unsubscribes
      // (aborting the fetch) and resubscribes before the abort has finished
      // propagating. Without this the cache would be stuck in 'loading'
      // forever, since nothing else re-triggers a fetch.
      if (controller.signal.aborted && entry.updatedAt === 0 && entry.listeners.size > 0) {
        ensureFresh(entry, fetcher, staleTime, isEmpty)
      }
    })
}

/**
 * Hand-written stale-while-revalidate cache, backed by useSyncExternalStore so
 * concurrent subscribers to the same key re-render off one shared entry.
 *
 * `isStale` is derived at render time from `entry.updatedAt` rather than kept
 * inside the synced snapshot: flipping it doesn't call notify(), so a
 * background revalidation that resolves as a 304 causes zero re-renders.
 */
export function useCachedResource<T>(
  key: string,
  fetcher: CachedFetcher<T>,
  options: { staleTime: number; isEmpty?: (data: T) => boolean },
): CachedResourceState<T> {
  const { staleTime, isEmpty = defaultIsEmpty<T> } = options

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const entry = getOrCreateEntry<T>(key)
      entry.listeners.add(onStoreChange)
      ensureFresh(entry, fetcher, staleTime, isEmpty)

      return () => {
        entry.listeners.delete(onStoreChange)
        // Only abandon the request once nobody is left waiting on it.
        if (entry.listeners.size === 0) {
          entry.abortController?.abort()
        }
      }
    },
    [key, fetcher, staleTime, isEmpty],
  )

  const getSnapshot = useCallback(() => getOrCreateEntry<T>(key).snapshot, [key])

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const refetch = useCallback(() => {
    const entry = getOrCreateEntry<T>(key)
    entry.updatedAt = 0
    ensureFresh(entry, fetcher, staleTime, isEmpty)
  }, [key, fetcher, staleTime, isEmpty])

  const entry = getOrCreateEntry<T>(key)
  const isStale = entry.updatedAt !== 0 && Date.now() - entry.updatedAt >= staleTime

  return { data: snapshot.data, status: snapshot.status, error: snapshot.error, isStale, refetch }
}
