import styled from 'styled-components'
import { performanceLevel } from '@/app/theme'

const Dot = styled.span<{ $level: 'low' | 'mid' | 'high' }>`
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-variant-numeric: tabular-nums;

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
export function PerformanceIndicator({ value, ariaLabel }: { value: number; ariaLabel: string }) {
  return (
    <Dot $level={performanceLevel(value)} aria-label={ariaLabel}>
      {Math.round(value)}
    </Dot>
  )
}
