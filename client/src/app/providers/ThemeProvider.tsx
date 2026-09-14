import type { ReactNode } from 'react'
import { ThemeProvider as StyledThemeProvider } from 'styled-components'
import { theme } from '@/app/theme'
import { GlobalStyle } from '@/app/GlobalStyle'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <StyledThemeProvider theme={theme}>
      <GlobalStyle />
      {children}
    </StyledThemeProvider>
  )
}
