import { useCallback, useEffect, useRef } from 'react'
import type { OrgTreeNode } from '@/entities/org/buildTree'
import { TreeNode } from './TreeNode'
import { TreeList } from './TreeNode.styles'
import { useTreeExpansion } from './useTreeExpansion'

export function OrgTree({
  roots,
  selectedId,
  revealAncestorIds,
  revealToken,
}: {
  roots: OrgTreeNode[]
  selectedId: string | null
  revealAncestorIds: string[]
  revealToken: number
}) {
  const { isExpanded, toggle, expandAncestors } = useTreeExpansion(roots)
  const nodeRefs = useRef(new Map<string, HTMLLIElement>())
  const lastRevealed = useRef<{ id: string | null; token: number }>({ id: null, token: -1 })

  const registerNode = useCallback(
    (id: string) => (el: HTMLLIElement | null) => {
      if (el) {
        nodeRefs.current.set(id, el)
      } else {
        nodeRefs.current.delete(id)
      }
    },
    [],
  )

  // Expands every collapsed ancestor of the selected node so it isn't hidden
  // behind a closed parent.
  useEffect(() => {
    expandAncestors(revealAncestorIds)
  }, [selectedId, revealToken, revealAncestorIds, expandAncestors])

  // `setExpanded` above is asynchronous — the target <li> only exists in the
  // DOM once the resulting re-render commits. `isExpanded`'s identity changes
  // exactly then (it's recreated whenever the expansion Set changes), which is
  // what this effect waits on before it scrolls to the now-mounted node.
  useEffect(() => {
    if (!selectedId) return
    const already = lastRevealed.current.id === selectedId && lastRevealed.current.token === revealToken
    if (already) return

    const el = nodeRefs.current.get(selectedId)
    if (!el) return

    el.scrollIntoView({ block: 'nearest' })
    lastRevealed.current = { id: selectedId, token: revealToken }
  }, [selectedId, revealToken, isExpanded])

  return (
    <TreeList role="tree" aria-label="Организационная структура">
      {roots.map((root) => (
        <TreeNode
          key={root.id}
          node={root}
          isExpanded={isExpanded}
          onToggle={toggle}
          selectedId={selectedId}
          registerNode={registerNode}
        />
      ))}
    </TreeList>
  )
}
