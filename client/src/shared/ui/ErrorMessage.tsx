import styled from 'styled-components'

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xl};
  border: 1px solid ${({ theme }) => theme.color.performance.low};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.color.surface};
  color: ${({ theme }) => theme.color.text};
`

const RetryButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surfaceRaised};
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.color.accent};
  }
`

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Wrapper role="alert">
      <span>{message}</span>
      {onRetry && <RetryButton onClick={onRetry}>Повторить</RetryButton>}
    </Wrapper>
  )
}
