import styled from 'styled-components'

export const TreeList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`

export const ChildrenList = styled(TreeList)`
  padding-left: ${({ theme }) => theme.spacing.xl};
`

// Two layers, not one: a grid track sized 0fr collapses the TRACK, but an
// intrinsically-sized <ul> inside it still fights that collapse unless
// something also clips it directly — the inner box's own overflow:hidden is
// the actual clip. min-height: 0 overrides grid/flex children's default
// min-height: auto (their content's natural size), which would otherwise
// prevent the 0fr state from fully collapsing.
export const ExpandableRegion = styled.div<{ $expanded: boolean }>`
  display: grid;
  grid-template-rows: ${({ $expanded }) => ($expanded ? '1fr' : '0fr')};
  transition: grid-template-rows ${({ theme }) => theme.duration.base} ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const ExpandableInner = styled.div`
  overflow: hidden;
  min-height: 0;
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

export const HeadcountBadge = styled.span<{ $isFresh?: boolean }>`
  flex: none;
  color: ${({ theme }) => theme.color.textMuted};
  font-size: ${({ theme }) => theme.font.size.sm};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 0 ${({ theme }) => theme.spacing.xs};
  background: ${({ theme, $isFresh }) => ($isFresh ? theme.color.highlight : 'transparent')};
  transition: background-color ${({ theme }) => theme.duration.slow} ease;

  @media (prefers-reduced-motion: reduce) {
    /* A fade would flash invisibly for one frame with transition: none — an
       instant, visible, then-instantly-removed highlight is the substitute
       CLAUDE.md §8 asks for, so the color still applies, just without the
       animated transition property. */
    transition: none;
  }
`
