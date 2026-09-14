import { useMemo, useState } from 'react'
import styled from 'styled-components'
import { useCachedResource } from '@/api/cache/useCachedResource'
import { fetchOrgTree, ORG_TREE_CACHE_KEY } from '@/api/orgTreeApi'
import { aggregateOrgTree, type OrgAggregateRow } from '@/entities/org/aggregate'
import { buildOrgTree, OrgTreeBuildError, type OrgTreeNode } from '@/entities/org/buildTree'
import type { OrgNodeDto } from '@/entities/org/schema'
import { AiSearchInput } from '@/features/ai-search/AiSearchInput'
import { ConnectionIndicator } from '@/features/connection/ConnectionIndicator'
import { OrgTable } from '@/features/org-table/OrgTable'
import { OrgTree } from '@/features/org-tree/OrgTree'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Spinner } from '@/shared/ui/Spinner'
import { DashboardGrid, Panel } from './OrgDashboard.styles'
import { useAiSearch } from './useAiSearch'
import { useOrgStream } from './useOrgStream'
import { ViewSwitch, type ViewMode } from './ViewSwitch'

const Centered = styled.div`
  display: flex;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.xxl};
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`

export function OrgDashboard() {
  const { data, status, error, refetch } = useCachedResource(ORG_TREE_CACHE_KEY, fetchOrgTree, { staleTime: 5000 })

  if (status === 'loading') {
    return (
      <Centered>
        <Spinner label="Загрузка орг-структуры…" />
      </Centered>
    )
  }

  if (status === 'error') {
    return <ErrorMessage message={error?.message ?? 'Не удалось загрузить орг-структуру.'} onRetry={refetch} />
  }

  if (status === 'empty' || !data || data.length === 0) {
    return <EmptyState message="Организационная структура пуста." />
  }

  return <OrgDashboardBuilt nodes={data} refetch={refetch} />
}

// Split out so buildOrgTree/aggregateOrgTree only ever run against data known
// to be non-empty, and so both are memoised on the stable `nodes` reference
// the cache layer guarantees — a 304 keeps that reference identical, so this
// (and the aggregation below) is skipped entirely, not just the tree view's
// share of it. This memo chain's output feeds `useOrgStream` as its INPUT,
// not the final rendered state — see useOrgStream.ts for why.
function OrgDashboardBuilt({ nodes, refetch }: { nodes: OrgNodeDto[]; refetch: () => void }) {
  const result = useMemo((): { roots: OrgTreeNode[]; byId: Map<string, OrgTreeNode>; error: Error | undefined } => {
    try {
      const built = buildOrgTree(nodes)
      return { ...built, error: undefined }
    } catch (err) {
      return { roots: [], byId: new Map(), error: err instanceof OrgTreeBuildError ? err : new Error(String(err)) }
    }
  }, [nodes])

  // One post-order DFS, run once per real data change — never recomputed
  // inside render (CLAUDE.md §8). Live SSE patches update on top of this via
  // useOrgStream's O(depth) delta walk, not by re-running this.
  const aggregates = useMemo(() => aggregateOrgTree(result.roots), [result.roots])

  if (result.error) {
    return <ErrorMessage message={result.error.message} onRetry={refetch} />
  }

  if (result.roots.length === 0) {
    return <EmptyState message="Организационная структура пуста." />
  }

  return <OrgDashboardView initialRoots={result.roots} initialAggregates={aggregates} initialById={result.byId} refetch={refetch} />
}

function OrgDashboardView({
  initialRoots,
  initialAggregates,
  initialById,
  refetch,
}: {
  initialRoots: OrgTreeNode[]
  initialAggregates: Map<string, OrgAggregateRow>
  initialById: Map<string, OrgTreeNode>
  refetch: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [revealToken, setRevealToken] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('tree')

  const { roots, aggregates, connectionStatus, retryDelayMs, freshness } = useOrgStream({
    initialRoots,
    initialAggregates,
    initialById,
    refetch,
  })

  const rows = useMemo(() => [...aggregates.values()], [aggregates])
  const { query, setQuery, visibleRows, status: searchStatus } = useAiSearch(rows)
  const revealAncestorIds = selectedId ? (aggregates.get(selectedId)?.ancestors.map((a) => a.id) ?? []) : []

  const handleRowClick = (id: string) => {
    setSelectedId(id)
    setRevealToken((token) => token + 1)
  }

  return (
    <>
      <Toolbar>
        <ViewSwitch value={viewMode} onChange={setViewMode} />
        <ConnectionIndicator status={connectionStatus} retryDelayMs={retryDelayMs} />
      </Toolbar>
      <DashboardGrid>
        <Panel $activeWhenNarrow={viewMode === 'tree'}>
          <OrgTree
            roots={roots}
            selectedId={selectedId}
            revealAncestorIds={revealAncestorIds}
            revealToken={revealToken}
            freshness={freshness}
          />
        </Panel>
        <Panel $activeWhenNarrow={viewMode === 'table'}>
          <AiSearchInput query={query} onQueryChange={setQuery} status={searchStatus} />
          <OrgTable rows={visibleRows} selectedId={selectedId} onRowClick={handleRowClick} freshness={freshness} />
        </Panel>
      </DashboardGrid>
    </>
  )
}
