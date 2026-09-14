import { useMemo, useState } from 'react'
import styled from 'styled-components'
import { useCachedResource } from '@/api/cache/useCachedResource'
import { fetchOrgTree, ORG_TREE_CACHE_KEY } from '@/api/orgTreeApi'
import { aggregateOrgTree, type OrgAggregateRow } from '@/entities/org/aggregate'
import { buildOrgTree, OrgTreeBuildError, type OrgTreeNode } from '@/entities/org/buildTree'
import type { OrgNodeDto } from '@/entities/org/schema'
import { OrgTable } from '@/features/org-table/OrgTable'
import { OrgTree } from '@/features/org-tree/OrgTree'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Spinner } from '@/shared/ui/Spinner'
import { DashboardGrid, Panel } from './OrgDashboard.styles'
import { ViewSwitch, type ViewMode } from './ViewSwitch'

const Centered = styled.div`
  display: flex;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.xxl};
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

  return <OrgDashboardBuilt nodes={data} onRetry={refetch} />
}

// Split out so buildOrgTree/aggregateOrgTree only ever run against data known
// to be non-empty, and so both are memoised on the stable `nodes` reference
// the cache layer guarantees — a 304 keeps that reference identical, so this
// (and the aggregation below) is skipped entirely, not just the tree view's
// share of it.
function OrgDashboardBuilt({ nodes, onRetry }: { nodes: OrgNodeDto[]; onRetry: () => void }) {
  const result = useMemo((): { roots: OrgTreeNode[]; error: Error | undefined } => {
    try {
      return { roots: buildOrgTree(nodes), error: undefined }
    } catch (err) {
      return { roots: [], error: err instanceof OrgTreeBuildError ? err : new Error(String(err)) }
    }
  }, [nodes])

  // One post-order DFS, run once per real data change and shared by both
  // views — never recomputed inside either one's render (CLAUDE.md §8).
  const aggregates = useMemo(() => aggregateOrgTree(result.roots), [result.roots])

  if (result.error) {
    return <ErrorMessage message={result.error.message} onRetry={onRetry} />
  }

  if (result.roots.length === 0) {
    return <EmptyState message="Организационная структура пуста." />
  }

  return <OrgDashboardView roots={result.roots} aggregates={aggregates} />
}

function OrgDashboardView({ roots, aggregates }: { roots: OrgTreeNode[]; aggregates: Map<string, OrgAggregateRow> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [revealToken, setRevealToken] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('tree')

  const rows = useMemo(() => [...aggregates.values()], [aggregates])
  const revealAncestorIds = selectedId ? (aggregates.get(selectedId)?.ancestors.map((a) => a.id) ?? []) : []

  const handleRowClick = (id: string) => {
    setSelectedId(id)
    setRevealToken((token) => token + 1)
  }

  return (
    <>
      <ViewSwitch value={viewMode} onChange={setViewMode} />
      <DashboardGrid>
        <Panel $activeWhenNarrow={viewMode === 'tree'}>
          <OrgTree roots={roots} selectedId={selectedId} revealAncestorIds={revealAncestorIds} revealToken={revealToken} />
        </Panel>
        <Panel $activeWhenNarrow={viewMode === 'table'}>
          <OrgTable rows={rows} selectedId={selectedId} onRowClick={handleRowClick} />
        </Panel>
      </DashboardGrid>
    </>
  )
}
