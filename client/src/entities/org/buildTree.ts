import type { OrgNodeDto } from './schema'

export type OrgTreeNode = OrgNodeDto & { children: OrgTreeNode[] }

export class OrgTreeBuildError extends Error {}

/**
 * Two-pass flat-array -> tree builder. Rejects malformed data rather than
 * skipping nodes: a duplicate id, a parentId pointing nowhere, or a cycle are
 * all thrown as OrgTreeBuildError instead of being silently dropped.
 */
export function buildOrgTree(flatNodes: OrgNodeDto[]): OrgTreeNode[] {
  const byId = new Map<string, OrgTreeNode>()

  for (const node of flatNodes) {
    if (byId.has(node.id)) {
      throw new OrgTreeBuildError(`Duplicate node id: "${node.id}"`)
    }
    byId.set(node.id, { ...node, children: [] })
  }

  const roots: OrgTreeNode[] = []

  for (const node of flatNodes) {
    const current = byId.get(node.id)
    if (!current) continue

    if (node.parentId === null) {
      roots.push(current)
      continue
    }

    const parent = byId.get(node.parentId)
    if (!parent) {
      throw new OrgTreeBuildError(`Node "${node.id}" references unknown parentId "${node.parentId}"`)
    }
    parent.children.push(current)
  }

  assertNoCycles(roots, byId, flatNodes.length)

  return roots
}

// Every node not reachable from a root by walking parent -> child links is
// part of a cycle (a self- or mutually-referencing parentId chain that never
// terminates at parentId: null).
function assertNoCycles(roots: OrgTreeNode[], byId: Map<string, OrgTreeNode>, totalCount: number): void {
  const visited = new Set<string>()
  const stack = [...roots]

  while (stack.length > 0) {
    const node = stack.pop()
    if (!node || visited.has(node.id)) continue
    visited.add(node.id)
    stack.push(...node.children)
  }

  if (visited.size !== totalCount) {
    const cyclic = [...byId.keys()].filter((id) => !visited.has(id))
    throw new OrgTreeBuildError(`Cycle detected among node(s): ${cyclic.join(', ')}`)
  }
}
