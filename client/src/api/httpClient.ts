export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export type FetchJsonResult<T> = { status: 'ok'; data: T; etag: string | null } | { status: 'not-modified' }

/**
 * Thin fetch wrapper: JSON in, JSON out, ETag-aware. A 304 short-circuits to
 * `{ status: 'not-modified' }` so callers never have to parse an empty body.
 */
export async function fetchJson<T>(
  url: string,
  options: { signal?: AbortSignal; ifNoneMatch?: string | null } = {},
): Promise<FetchJsonResult<T>> {
  const headers: HeadersInit = {}
  if (options.ifNoneMatch) headers['If-None-Match'] = options.ifNoneMatch

  const response = await fetch(url, { signal: options.signal, headers })

  if (response.status === 304) {
    return { status: 'not-modified' }
  }

  if (!response.ok) {
    let message = response.statusText || `Request failed with status ${response.status}`
    try {
      const body: unknown = await response.json()
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        message = body.error
      }
    } catch {
      // no JSON body on the error response — keep the status-derived message
    }
    throw new HttpError(response.status, message)
  }

  const data = (await response.json()) as T
  return { status: 'ok', data, etag: response.headers.get('ETag') }
}
