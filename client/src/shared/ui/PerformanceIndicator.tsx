import styled from 'styled-components'
import { performanceLevel } from '@/app/theme'

const Dot = styled.span<{ $level: 'low' | 'mid' | 'high'; $isFresh?: boolean }>`
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-variant-numeric: tabular-nums;
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 0 ${({ theme }) => theme.spacing.xs};
  background: ${({ theme, $isFresh }) => ($isFresh ? theme.color.highlight : 'transparent')};
  transition: background-color ${({ theme }) => theme.duration.slow} ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: ${({ theme }) => theme.radius.full};
    background: ${({ theme, $level }) => theme.color.performance[$level]};
  }
`

// Color is never the sole carrier of meaning: the numeric value is always
// rendered alongside the dot, and `ariaLabel` spells it out for screen readers.
export function PerformanceIndicator({
  value,
  ariaLabel,
  isFresh,
}: {
  value: number
  ariaLabel: string
  isFresh?: boolean
}) {
  return (
    <Dot $level={performanceLevel(value)} $isFresh={isFresh} aria-label={ariaLabel}>
      {Math.round(value)}
    </Dot>
  )
}
