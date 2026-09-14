import { useCallback, useState } from 'react'
import type { OrgTreeNode } from '@/entities/org/types'

// "The second level is expanded by default" (CLAUDE.md §13): with a company
// -> divisions -> departments -> teams tree, expanding the root is what
// reveals the second level (divisions) — only the root itself starts open.
// Divisions are visible but not themselves expanded, so departments (level 3)
// start collapsed, one click away. (A prior version of this function also
// expanded the divisions, which additionally revealed departments by
// default — a real deviation from the spec's literal wording, not a
// documented interpretation; see docs/ai-log.md's step/1 entry, written
// against the same "second level" reading this fix restores.)
function computeDefaultExpanded(roots: OrgTreeNode[]): Set<string> {
  const expanded = new Set<string>()
  for (const root of roots) {
    expanded.add(root.id)
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
