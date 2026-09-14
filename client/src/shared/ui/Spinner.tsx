import styled, { keyframes } from 'styled-components'

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`

const SpinnerRing = styled.div`
  width: ${({ theme }) => theme.spacing.xl};
  height: ${({ theme }) => theme.spacing.xl};
  border: 3px solid ${({ theme }) => theme.color.border};
  border-top-color: ${({ theme }) => theme.color.accent};
  border-radius: ${({ theme }) => theme.radius.full};
  animation: ${spin} 0.8s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 2.4s;
  }
`

export function Spinner({ label = 'Загрузка…' }: { label?: string }) {
  return <SpinnerRing role="status" aria-label={label} />
}
