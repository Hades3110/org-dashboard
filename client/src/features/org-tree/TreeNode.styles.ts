import styled from 'styled-components'

export const TreeList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`

export const ChildrenList = styled(TreeList)`
  padding-left: ${({ theme }) => theme.spacing.xl};
`

export const NodeRow = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme, $selected }) => ($selected ? theme.color.surfaceRaised : 'transparent')};
  outline: ${({ theme, $selected }) => ($selected ? `1px solid ${theme.color.accent}` : 'none')};
  outline-offset: -1px;

  &:hover {
    background: ${({ theme }) => theme.color.surfaceRaised};
  }
`

export const ToggleButton = styled.button<{ $expanded: boolean; $visible: boolean }>`
  flex: none;
  width: ${({ theme }) => theme.spacing.lg};
  height: ${({ theme }) => theme.spacing.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.color.textMuted};
  cursor: pointer;
  visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
  transform: rotate(${({ $expanded }) => ($expanded ? 90 : 0)}deg);
  transition: transform ${({ theme }) => theme.duration.fast} ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const NodeName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const HeadcountBadge = styled.span`
  flex: none;
  color: ${({ theme }) => theme.color.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
`
