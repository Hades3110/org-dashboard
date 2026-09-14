import { useMemo } from 'react'
import styled from 'styled-components'
import { useCachedResource } from '@/api/cache/useCachedResource'
import { fetchOrgTree, ORG_TREE_CACHE_KEY } from '@/api/orgTreeApi'
import { buildOrgTree, OrgTreeBuildError, type OrgTreeNode } from '@/entities/org/buildTree'
import type { OrgNodeDto } from '@/entities/org/schema'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { Spinner } from '@/shared/ui/Spinner'
import { TreeNode } from './TreeNode'
import { TreeList } from './TreeNode.styles'
import { useTreeExpansion } from './useTreeExpansion'

const Centered = styled.div`
  display: flex;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.xxl};
`

export function OrgTree() {
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

  return <OrgTreeBuilt nodes={data} onRetry={refetch} />
}

// Split out so buildOrgTree only ever runs against data we know is non-empty,
// and so it can be memoised on the stable `nodes` reference the cache layer
// guarantees (no re-render of useCachedResource itself skips this work).
function OrgTreeBuilt({ nodes, onRetry }: { nodes: OrgNodeDto[]; onRetry: () => void }) {
  const result = useMemo((): { roots: OrgTreeNode[]; error: Error | undefined } => {
    try {
      return { roots: buildOrgTree(nodes), error: undefined }
    } catch (err) {
      return { roots: [], error: err instanceof OrgTreeBuildError ? err : new Error(String(err)) }
    }
  }, [nodes])

  if (result.error) {
    return <ErrorMessage message={result.error.message} onRetry={onRetry} />
  }

  if (result.roots.length === 0) {
    return <EmptyState message="Организационная структура пуста." />
  }

  return <OrgTreeView roots={result.roots} />
}

function OrgTreeView({ roots }: { roots: OrgTreeNode[] }) {
  const { isExpanded, toggle } = useTreeExpansion(roots)

  return (
    <TreeList role="tree" aria-label="Организационная структура">
      {roots.map((root) => (
        <TreeNode key={root.id} node={root} isExpanded={isExpanded} onToggle={toggle} />
      ))}
    </TreeList>
  )
}
