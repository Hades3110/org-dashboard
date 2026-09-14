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
  /* A grid item's default automatic minimum width is its content's
     min-content size, not 0 — without this override, the two 1fr columns
     don't actually split 50/50: whichever panel's content is wider (e.g.
     the table with many rows vs. few) drags width away from the other, and
     the split visibly shifts as the table's row count changes (e.g. an
     empty search result narrows the table and widens the tree). Setting
     min-width to 0 lets each column size purely from its 1fr share;
     TableScroll's own overflow-x: auto still scrolls internally if content
     is wider than that. */
  min-width: 0;

  @media (min-width: ${({ theme }) => theme.breakpoints.split}) {
    display: block;
  }
`
