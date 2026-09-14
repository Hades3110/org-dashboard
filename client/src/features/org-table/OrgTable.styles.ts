import styled from 'styled-components'

export const TableWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

export const TableScroll = styled.div`
  overflow-x: auto;
`

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`

export const Thead = styled.thead``

export const Th = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.color.textMuted};
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
  white-space: nowrap;
  cursor: pointer;
  user-select: none;

  &:hover {
    color: ${({ theme }) => theme.color.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.focusRing};
    outline-offset: -2px;
  }
`

export const Tbody = styled.tbody``

export const Tr = styled.tr<{ $selected?: boolean }>`
  cursor: pointer;
  background: ${({ theme, $selected }) => ($selected ? theme.color.surfaceRaised : 'transparent')};

  &:hover {
    background: ${({ theme }) => theme.color.surfaceRaised};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.focusRing};
    outline-offset: -2px;
  }
`

export const Td = styled.td<{ $isFresh?: boolean }>`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
  font-variant-numeric: tabular-nums;
  background: ${({ theme, $isFresh }) => ($isFresh ? theme.color.highlight : 'transparent')};
  transition: background-color ${({ theme }) => theme.duration.slow} ease;

  @media (prefers-reduced-motion: reduce) {
    /* Same reasoning as the tree's HeadcountBadge: an instant, visible,
       then-instantly-removed highlight, not a silent fade. */
    transition: none;
  }
`

export const NameCell = styled.div`
  max-width: 16rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const PathBreadcrumb = styled.div`
  max-width: 16rem;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.color.textMuted};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
