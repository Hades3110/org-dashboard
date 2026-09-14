import styled from 'styled-components'
import type { ConnectionStatus } from '@/api/sse/useSseConnection'

export const Wrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`

export const Dot = styled.span<{ $status: ConnectionStatus }>`
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme, $status }) =>
    $status === 'open'
      ? theme.color.connection.open
      : $status === 'reconnecting'
        ? theme.color.connection.reconnecting
        : theme.color.textMuted};
`

export const StatusText = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.color.textMuted};
`
