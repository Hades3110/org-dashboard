import { useEffect, useState } from 'react'

function isWithinWindow(changedAt: number | null, durationMs: number): boolean {
  return changedAt !== null && Date.now() - changedAt < durationMs
}

/**
 * True for `durationMs` after `changedAt` (a timestamp, not a boolean) is set,
 * then false. Keying the effect on the timestamp rather than a derived
 * boolean is what makes a second change within the window correctly restart
 * the fade instead of piling up timers — the effect re-runs on every new
 * `changedAt`, clearing the previous timer before starting a new one, the
 * same shape as useDebouncedValue.
 *
 * Freshness is judged by the timestamp's AGE, not merely whether it's
 * non-null — a component that mounts (or remounts) well after `changedAt`
 * must not flash as if the change just happened. This matters because
 * `freshness` entries in useOrgStream are never pruned, and org-table rows
 * unmount/remount whenever the AI-search filter narrows and then clears the
 * table — without the age check, every row that was EVER touched by a past
 * SSE patch would flash on remount, regardless of how long ago.
 */
export function useFreshHighlight(changedAt: number | null, durationMs = 1500): boolean {
  const [isFresh, setIsFresh] = useState(() => isWithinWindow(changedAt, durationMs))

  useEffect(() => {
    if (changedAt === null) {
      setIsFresh(false)
      return
    }
    const remainingMs = durationMs - (Date.now() - changedAt)
    if (remainingMs <= 0) {
      setIsFresh(false)
      return
    }
    setIsFresh(true)
    const timer = setTimeout(() => setIsFresh(false), remainingMs)
    return () => clearTimeout(timer)
  }, [changedAt, durationMs])

  return isFresh
}
