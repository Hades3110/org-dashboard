import { orgTreeResponseSchema } from '@/entities/org/schema'
import type { OrgNodeDto } from '@/entities/org/schema'
import type { CachedFetchResult } from './cache/useCachedResource'
import { fetchJson } from './httpClient'

export class OrgTreeValidationError extends Error {
  constructor(cause: string) {
    super(`Invalid /api/org-tree payload: ${cause}`)
    this.name = 'OrgTreeValidationError'
  }
}

export const ORG_TREE_CACHE_KEY = 'org-tree'

export async function fetchOrgTree(context: {
  signal: AbortSignal
  etag: string | null
}): Promise<CachedFetchResult<OrgNodeDto[]>> {
  // Forwards the page's own ?scenario=/?delay= (CLAUDE.md §4) straight through
  // to the API, so navigating to e.g. /?scenario=empty exercises the real UI
  // state instead of requiring a separate curl/REST-client round trip.
  const result = await fetchJson<unknown>(`/api/org-tree${window.location.search}`, {
    signal: context.signal,
    ifNoneMatch: context.etag,
  })

  if (result.status === 'not-modified') {
    return { status: 'not-modified' }
  }

  const parsed = orgTreeResponseSchema.safeParse(result.data)
  if (!parsed.success) {
    const summary = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new OrgTreeValidationError(summary)
  }

  return { status: 'ok', data: parsed.data, etag: result.etag }
}
