import { useEffect, useMemo, useState } from 'react'
import type { OrgAggregateRow } from '@/entities/org/aggregate'
import { applyStructuredFilter, structuredFilterSchema, type StructuredFilter } from '@/entities/org/search'
import type { AiSearchStatus } from '@/features/ai-search/types'
import { filterRowsByName } from '@/features/org-table/filterRowsByName'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'

const DEBOUNCE_MS = 400

/**
 * Orchestration for the AI search feature — logic lives here in `app`,
 * `features/ai-search/AiSearchInput` stays purely presentational, same split
 * as `useOrgStream` / `ConnectionIndicator` in step/3.
 *
 * The raw `query` drives an instant local `filterRowsByName` (existing
 * function from `features/org-table`, reused via the allowed `app → features`
 * import) so typing never waits on a network round trip. A 400ms-debounced
 * copy of the query triggers the AI call in the background; on success,
 * `visibleRows` upgrades to the structured filter's result. On any failure —
 * or once the user has typed past whatever query produced the last AI
 * result — it silently stays on the instant text-filtered view. "Fallback"
 * is therefore not a distinct code path for `visibleRows`, just the absence
 * of a still-current AI result; `status` alone reports which one is active
 * for `AiSearchInput`'s indicator.
 */
export function useAiSearch(
  rows: OrgAggregateRow[],
  fetchImpl: typeof fetch = fetch,
): { query: string; setQuery: (value: string) => void; visibleRows: OrgAggregateRow[]; status: AiSearchStatus } {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)

  const [aiResult, setAiResult] = useState<{ query: string; filter: StructuredFilter } | null>(null)
  const [status, setStatus] = useState<AiSearchStatus>('idle')

  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (trimmed === '') {
      setStatus('idle')
      return
    }

    const controller = new AbortController()
    setStatus('thinking')

    fetchImpl('/api/ai-search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: trimmed }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (controller.signal.aborted) return
        if (!response.ok) throw new Error(`ai-search responded ${response.status}`)

        const body: unknown = await response.json()
        const parsed = structuredFilterSchema.safeParse((body as { filter?: unknown }).filter)
        if (!parsed.success) throw new Error('ai-search returned an invalid filter')

        if (controller.signal.aborted) return
        setAiResult({ query: trimmed, filter: parsed.data })
        setStatus('ai')
      })
      .catch(() => {
        if (controller.signal.aborted) return // superseded by a newer query — not a failure
        setStatus('fallback')
      })

    return () => controller.abort()
  }, [debouncedQuery, fetchImpl])

  const visibleRows = useMemo(() => {
    const trimmedQuery = query.trim()
    if (status === 'ai' && aiResult && aiResult.query === trimmedQuery) {
      return applyStructuredFilter(rows, aiResult.filter)
    }
    return filterRowsByName(rows, query)
  }, [rows, query, status, aiResult])

  return { query, setQuery, visibleRows, status }
}
