import styled from 'styled-components'

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.xxl};
  color: ${({ theme }) => theme.color.textMuted};
  border: 1px dashed ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.md};
`

export function EmptyState({ message }: { message: string }) {
  return <Wrapper>{message}</Wrapper>
}
