const headcountFormatter = new Intl.NumberFormat('ru-RU')
const budgetFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

export function formatHeadcount(value: number): string {
  return `${headcountFormatter.format(value)} чел.`
}

export function formatBudget(amount: number): string {
  return `${budgetFormatter.format(amount)} руб.`
}

export function formatPerformance(value: number | null): string {
  return value === null ? '—' : String(Math.round(value))
}
