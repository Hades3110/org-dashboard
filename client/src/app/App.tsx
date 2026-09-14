import styled from 'styled-components'
import { OrgDashboard } from './OrgDashboard'
import { ThemeProvider } from './providers/ThemeProvider'

const Page = styled.div`
  min-height: 100%;
  padding: ${({ theme }) => theme.spacing.xl};
  max-width: 960px;
  margin: 0 auto;

  @media (min-width: ${({ theme }) => theme.breakpoints.split}) {
    max-width: 1600px;
  }
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
        <OrgDashboard />
      </Page>
    </ThemeProvider>
  )
}
