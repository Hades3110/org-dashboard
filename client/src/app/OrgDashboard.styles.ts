import styled from 'styled-components'

// Both panels stay mounted at all times — only their CSS visibility toggles.
// That's what lets tree-expansion state and table sort/filter state survive
// both a window resize and the user flipping the tree/table switch, with no
// matchMedia subscription to set up or clean up.
export const DashboardGrid = styled.div`
  display: block;

  @media (min-width: ${({ theme }) => theme.breakpoints.split}) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.xl};
    align-items: start;
  }
`

export const Panel = styled.div<{ $activeWhenNarrow: boolean }>`
  display: ${({ $activeWhenNarrow }) => ($activeWhenNarrow ? 'block' : 'none')};

  @media (min-width: ${({ theme }) => theme.breakpoints.split}) {
    display: block;
  }
`
