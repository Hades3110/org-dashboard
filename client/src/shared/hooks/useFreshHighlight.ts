import { useEffect, useState } from 'react'

/**
 * True for `durationMs` after `changedAt` (a timestamp, not a boolean) is set,
 * then false. Keying the effect on the timestamp rather than a derived
 * boolean is what makes a second change within the window correctly restart
 * the fade instead of piling up timers — the effect re-runs on every new
 * `changedAt`, clearing the previous timer before starting a new one, the
 * same shape as useDebouncedValue.
 */
export function useFreshHighlight(changedAt: number | null, durationMs = 1500): boolean {
  const [isFresh, setIsFresh] = useState(changedAt !== null)

  useEffect(() => {
    if (changedAt === null) {
      setIsFresh(false)
      return
    }
    setIsFresh(true)
    const timer = setTimeout(() => setIsFresh(false), durationMs)
    return () => clearTimeout(timer)
  }, [changedAt, durationMs])

  return isFresh
}
