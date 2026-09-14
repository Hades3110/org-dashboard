import styled from 'styled-components'

export type ViewMode = 'tree' | 'table'

const SwitchWrapper = styled.div`
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.md};
  width: fit-content;

  // Above the split breakpoint both views are always visible side by side, so
  // a switch between them would imply a choice that no longer exists.
  @media (min-width: ${({ theme }) => theme.breakpoints.split}) {
    display: none;
  }
`

const SwitchButton = styled.button<{ $active: boolean }>`
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg};
  border: none;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme, $active }) => ($active ? theme.color.surfaceRaised : 'transparent')};
  color: ${({ theme, $active }) => ($active ? theme.color.text : theme.color.textMuted)};
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.focusRing};
    outline-offset: 2px;
  }
`

export function ViewSwitch({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <SwitchWrapper role="tablist" aria-label="Вид отображения">
      <SwitchButton type="button" role="tab" aria-selected={value === 'tree'} $active={value === 'tree'} onClick={() => onChange('tree')}>
        Дерево
      </SwitchButton>
      <SwitchButton
        type="button"
        role="tab"
        aria-selected={value === 'table'}
        $active={value === 'table'}
        onClick={() => onChange('table')}
      >
        Таблица
      </SwitchButton>
    </SwitchWrapper>
  )
}
