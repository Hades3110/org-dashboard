import { useCallback, useState } from 'react'
import type { OrgTreeNode } from '@/entities/org/types'

// "The second level is expanded by default": with a company -> divisions ->
// departments -> teams tree, that means levels 1 and 2 (the root and its
// direct children) start open, so departments are visible but teams are not.
function computeDefaultExpanded(roots: OrgTreeNode[]): Set<string> {
  const expanded = new Set<string>()
  for (const root of roots) {
    expanded.add(root.id)
    for (const child of root.children) {
      expanded.add(child.id)
    }
  }
  return expanded
}

export function useTreeExpansion(roots: OrgTreeNode[]) {
  const [expanded, setExpanded] = useState<Set<string>>(() => computeDefaultExpanded(roots))

  const isExpanded = useCallback((id: string) => expanded.has(id), [expanded])

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Batched: expands every id in one update, and returns the same Set
  // reference (no-op, no re-render) if all of them are already expanded.
  const expandAncestors = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    setExpanded((prev) => {
      if (ids.every((id) => prev.has(id))) return prev
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
  }, [])

  return { isExpanded, toggle, expandAncestors }
}
