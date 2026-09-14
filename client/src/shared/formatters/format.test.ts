import { describe, expect, it } from 'vitest'
import { formatBudget, formatHeadcount, formatPerformance } from './format'

// Intl.NumberFormat emits different thousands-separator characters across
// runtimes (non-breaking space in some, narrow no-break space in others) —
// normalize before comparing instead of hardcoding one, per CLAUDE.md §11.
const NON_STANDARD_SPACES = new RegExp(`[${String.fromCharCode(0x00a0, 0x202f)}]`, 'g')

function normalizeSpaces(value: string): string {
  return value.replace(NON_STANDARD_SPACES, ' ')
}

describe('formatBudget', () => {
  it('formats with thousands separators and a "руб." suffix', () => {
    expect(normalizeSpaces(formatBudget(12345678))).toBe('12 345 678 руб.')
  })

  it('rounds to whole rubles', () => {
    expect(normalizeSpaces(formatBudget(999.6))).toBe('1 000 руб.')
  })

  it('formats zero', () => {
    expect(normalizeSpaces(formatBudget(0))).toBe('0 руб.')
  })
})

describe('formatHeadcount', () => {
  it('formats with thousands separators and a "чел." suffix', () => {
    expect(normalizeSpaces(formatHeadcount(1234))).toBe('1 234 чел.')
  })
})

describe('formatPerformance', () => {
  it('renders an em dash for null', () => {
    expect(formatPerformance(null)).toBe('—')
  })

  it('rounds a numeric value', () => {
    expect(formatPerformance(79.6)).toBe('80')
  })
})
