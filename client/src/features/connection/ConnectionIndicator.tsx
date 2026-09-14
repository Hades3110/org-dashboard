import { useEffect, useState } from 'react'
import type { ConnectionStatus } from '@/api/sse/useSseConnection'
import { Dot, StatusText, Wrapper } from './ConnectionIndicator.styles'

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Подключение…',
  open: 'Подключено',
  reconnecting: 'Переподключение…',
}

// Ticks down locally from a captured target timestamp rather than re-reading
// a decrementing prop — only this small component re-renders every 250ms,
// not the whole dashboard.
function useCountdownSeconds(retryDelayMs: number | null): number | null {
  const [remainingMs, setRemainingMs] = useState(retryDelayMs)

  useEffect(() => {
    if (retryDelayMs === null) {
      setRemainingMs(null)
      return
    }
    const retryAt = Date.now() + retryDelayMs
    setRemainingMs(retryDelayMs)

    const timer = setInterval(() => setRemainingMs(Math.max(0, retryAt - Date.now())), 250)
    return () => clearInterval(timer)
  }, [retryDelayMs])

  return remainingMs === null ? null : Math.ceil(remainingMs / 1000)
}

export function ConnectionIndicator({
  status,
  retryDelayMs,
}: {
  status: ConnectionStatus
  retryDelayMs: number | null
}) {
  const countdownSeconds = useCountdownSeconds(status === 'reconnecting' ? retryDelayMs : null)

  const label =
    status === 'reconnecting' && countdownSeconds !== null
      ? `Переподключение через ${countdownSeconds} с…`
      : STATUS_LABEL[status]

  return (
    <Wrapper>
      {/* Color is never the sole carrier of meaning — the text always says it too. */}
      <Dot $status={status} aria-hidden="true" />
      <StatusText aria-live="polite">{label}</StatusText>
    </Wrapper>
  )
}
