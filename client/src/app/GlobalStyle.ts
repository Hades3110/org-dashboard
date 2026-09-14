import { createGlobalStyle } from 'styled-components'

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  html, body, #root {
    height: 100%;
  }

  body {
    margin: 0;
    background: ${({ theme }) => theme.color.background};
    color: ${({ theme }) => theme.color.text};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: ${({ theme }) => theme.font.size.md};
    -webkit-font-smoothing: antialiased;
  }

  button, input {
    font: inherit;
    color: inherit;
  }

  :focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.focusRing};
    outline-offset: 2px;
  }
`
