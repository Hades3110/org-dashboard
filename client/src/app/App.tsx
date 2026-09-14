import styled from 'styled-components'
import { OrgTree } from '@/features/org-tree/OrgTree'
import { ThemeProvider } from './providers/ThemeProvider'

const Page = styled.div`
  min-height: 100%;
  padding: ${({ theme }) => theme.spacing.xl};
  max-width: 960px;
  margin: 0 auto;
`

const Header = styled.header`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.xl};
`

export function App() {
  return (
    <ThemeProvider>
      <Page>
        <Header>
          <Title>Org Dashboard</Title>
        </Header>
        <OrgTree />
      </Page>
    </ThemeProvider>
  )
}
