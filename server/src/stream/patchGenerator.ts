import type { NodeChange, OrgNodeDto } from '../types.js'

function pickDistinctIndices(count: number, total: number, rng: () => number): number[] {
  const indices = new Set<number>()
  while (indices.size < count && indices.size < total) {
    indices.add(Math.floor(rng() * total))
  }
  return [...indices]
}

function nextHeadcount(current: number, rng: () => number): number {
  return Math.max(0, Math.round(current * (1 + (rng() * 0.2 - 0.1))))
}

function nextBudget(current: number, rng: () => number): number {
  return Math.max(0, Math.round(current * (1 + (rng() * 0.2 - 0.1))))
}

function nextPerformance(current: number, rng: () => number): number {
  return Math.min(100, Math.max(0, Math.round(current + (rng() * 10 - 5))))
}

/**
 * Mutates 1-3 random nodes in place and returns the changes actually made.
 * Each field changes independently (~65% chance) rather than all-or-nothing,
 * so only some cells "light up" per patch — the per-field freshness highlight
 * on the client only means something if patches actually exercise that.
 */
export function mutateRandomNodes(nodes: OrgNodeDto[], rng: () => number = Math.random): NodeChange[] {
  const count = 1 + Math.floor(rng() * 3)
  const indices = pickDistinctIndices(count, nodes.length, rng)
  const changes: NodeChange[] = []

  for (const index of indices) {
    const node = nodes[index]
    if (!node) continue

    const change: NodeChange = { id: node.id, updatedAt: new Date().toISOString() }
    let touchedAnyField = false

    if (rng() < 0.65) {
      change.headcount = nextHeadcount(node.headcount, rng)
      touchedAnyField = true
    }
    if (rng() < 0.65) {
      change.budget = nextBudget(node.budget, rng)
      touchedAnyField = true
    }
    if (rng() < 0.65) {
      change.performance = nextPerformance(node.performance, rng)
      touchedAnyField = true
    }
    // Every picked node must actually change something, or the patch would
    // be a no-op the client can't tell from a dropped frame.
    if (!touchedAnyField) {
      change.performance = nextPerformance(node.performance, rng)
    }

    if (change.headcount !== undefined) node.headcount = change.headcount
    if (change.budget !== undefined) node.budget = change.budget
    if (change.performance !== undefined) node.performance = change.performance
    node.updatedAt = change.updatedAt

    changes.push(change)
  }

  return changes
}
