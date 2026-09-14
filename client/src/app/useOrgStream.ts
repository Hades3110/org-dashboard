import { useEffect, useRef, useState } from 'react'
import { useSseConnection, type ConnectionStatus } from '@/api/sse/useSseConnection'
import type { OrgAggregateRow } from '@/entities/org/aggregate'
import { applyNodeChanges } from '@/entities/org/applyPatch'
import type { OrgTreeNode } from '@/entities/org/buildTree'
import { streamEventSchema, type Freshness, type StreamEvent } from '@/entities/org/patch'

export type { Freshness } from '@/entities/org/patch'

const STREAM_URL = '/api/stream'

function parseStreamEvent(raw: string): StreamEvent | null {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }
  const result = streamEventSchema.safeParse(json)
  return result.success ? result.data : null
}

/**
 * Owns the tree/aggregate state actually rendered, applying SSE patches
 * incrementally on top of whatever the last real fetch produced. Deliberately
 * separate from the `useMemo(buildOrgTree/aggregateOrgTree)` chain in
 * OrgDashboard: that memo's output is this hook's INPUT (re-seeded whenever a
 * real fetch/revalidation lands), not its final state — otherwise a patch
 * flowing back through that memo chain would trigger a full rebuild and
 * re-aggregation, exactly what CLAUDE.md §7 rules out.
 */
export function useOrgStream(args: {
  initialRoots: OrgTreeNode[]
  initialAggregates: Map<string, OrgAggregateRow>
  initialById: Map<string, OrgTreeNode>
  refetch: () => void
}): {
  roots: OrgTreeNode[]
  aggregates: Map<string, OrgAggregateRow>
  connectionStatus: ConnectionStatus
  retryDelayMs: number | null
  freshness: Freshness
} {
  const { initialRoots, initialAggregates, initialById, refetch } = args

  const [roots, setRoots] = useState(initialRoots)
  const [aggregates, setAggregates] = useState(initialAggregates)
  const [freshness, setFreshness] = useState<Freshness>(() => new Map())

  const byIdRef = useRef(initialById)
  const seenInitialRootsRef = useRef(initialRoots)
  const lastRevisionRef = useRef<number | null>(null)

  // A real fetch/revalidation landed (new `initialRoots` reference) — re-seed
  // everything from it. Done during render, the React-documented pattern for
  // "derived state that should reset when a prop changes": an effect-based
  // reset would render once with stale data and again after the effect runs,
  // and could race a patch arriving in the same tick.
  if (initialRoots !== seenInitialRootsRef.current) {
    seenInitialRootsRef.current = initialRoots
    byIdRef.current = initialById
    lastRevisionRef.current = null
    setRoots(initialRoots)
    setAggregates(initialAggregates)
    setFreshness(new Map())
  }

  const { status, lastMessage, retryDelayMs } = useSseConnection(STREAM_URL, parseStreamEvent)

  useEffect(() => {
    if (!lastMessage) return

    const gap = lastRevisionRef.current !== null && lastMessage.revision !== lastRevisionRef.current + 1
    lastRevisionRef.current = lastMessage.revision

    // A missed revision means the two views could silently drift apart — the
    // full refetch above re-seeds everything, so applying this (possibly
    // already-stale) patch on top would be redundant at best.
    if (gap) {
      refetch()
      return
    }

    if (lastMessage.type === 'heartbeat') return

    setAggregates((prev) => applyNodeChanges(byIdRef.current, prev, lastMessage.changes))
    // applyNodeChanges mutates OrgTreeNode fields in place, so `roots` itself
    // doesn't change — bump it alongside `aggregates` anyway (cheap top-level
    // copy) so anything that ever keys off `roots`' identity stays correct
    // too, not just the aggregates-driven render path.
    setRoots((prev) => [...prev])

    const now = Date.now()
    setFreshness((prev) => {
      const next = new Map(prev)
      for (const change of lastMessage.changes) {
        const fields = { ...next.get(change.id) }
        if (change.headcount !== undefined) fields.headcount = now
        if (change.budget !== undefined) fields.budget = now
        if (change.performance !== undefined) fields.performance = now
        next.set(change.id, fields)
      }
      return next
    })
  }, [lastMessage, refetch])

  return { roots, aggregates, connectionStatus: status, retryDelayMs, freshness }
}
