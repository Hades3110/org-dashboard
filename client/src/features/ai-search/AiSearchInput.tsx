import type { ChangeEvent } from 'react'
import type { AiSearchStatus } from './types'
import { Input, StatusText, Wrapper } from './AiSearchInput.styles'

const STATUS_LABEL: Record<AiSearchStatus, string> = {
  idle: '',
  thinking: 'Ищу…',
  ai: 'Результаты уточнены ИИ',
  fallback: 'Обычный поиск по названию',
}

export function AiSearchInput({
  query,
  onQueryChange,
  status,
}: {
  query: string
  onQueryChange: (value: string) => void
  status: AiSearchStatus
}) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)

  return (
    <Wrapper>
      <Input
        type="search"
        placeholder="Например: отделы с эффективностью ниже 50…"
        aria-label="Поиск по орг-структуре: обычный текст или запрос на естественном языке"
        value={query}
        onChange={handleChange}
      />
      <StatusText aria-live="polite">{STATUS_LABEL[status]}</StatusText>
    </Wrapper>
  )
}
