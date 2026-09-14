export const theme = {
  color: {
    background: '#0f1115',
    surface: '#171a21',
    surfaceRaised: '#1f232c',
    border: '#2b303b',
    text: '#e7e9ee',
    textMuted: '#9aa1ae',
    accent: '#5b8cff',
    focusRing: '#5b8cff',
    performance: {
      low: '#e5484d',
      mid: '#f5a524',
      high: '#3dd68c',
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    xxl: '2.5rem',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '999px',
  },
  duration: {
    fast: '120ms',
    base: '200ms',
    slow: '1500ms',
  },
  font: {
    size: {
      sm: '0.8125rem',
      md: '0.9375rem',
      lg: '1.125rem',
      xl: '1.5rem',
    },
  },
  // Width at which tree and table are shown side by side instead of behind a
  // switch (CLAUDE.md §13, step/2).
  breakpoints: {
    split: '1280px',
  },
} as const

export type AppTheme = typeof theme

// Thresholds for the performance color indicator (§8: color is never the only
// carrier of meaning — callers must still render the numeric value).
export function performanceLevel(value: number): 'low' | 'mid' | 'high' {
  if (value < 50) return 'low'
  if (value < 75) return 'mid'
  return 'high'
}
