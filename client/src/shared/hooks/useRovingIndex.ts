import { useCallback, useRef, useState, type KeyboardEvent } from 'react'

export type RovingOrientation = 'horizontal' | 'vertical'

/**
 * Roving tabindex: only the active item is a Tab stop, arrow keys move
 * between items, Home/End jump to the ends. Enter is deliberately NOT
 * handled here — it means something different at each call site (sort vs.
 * row-select), while arrow/Home/End movement is identical everywhere, so
 * only the shared part is factored out.
 */
export function useRovingIndex(count: number, orientation: RovingOrientation = 'vertical') {
  const [activeIndex, setActiveIndex] = useState(0)
  const items = useRef(new Map<number, HTMLElement>())

  // Clamp during render (not an effect) when the item count shrinks — e.g. a
  // table filter narrows the row list out from under a focused index. Doing
  // this as a plain render-time adjustment avoids both an extra render and a
  // race against a keyboard move landing in the same tick.
  const clampedIndex = count > 0 ? Math.min(activeIndex, count - 1) : 0
  if (clampedIndex !== activeIndex) {
    setActiveIndex(clampedIndex)
  }

  const registerItem = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      if (el) items.current.set(index, el)
      else items.current.delete(index)
    },
    [],
  )

  const moveTo = useCallback(
    (index: number) => {
      if (count === 0) return
      const next = Math.max(0, Math.min(count - 1, index))
      setActiveIndex(next)
      // Synchronous, in the same handler that decided where focus goes —
      // not a useEffect reacting to activeIndex — so the move feels instant.
      items.current.get(next)?.focus()
    },
    [count],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent, currentIndex: number) => {
      const forwardKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
      const backwardKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'

      switch (event.key) {
        case forwardKey:
          event.preventDefault()
          moveTo(currentIndex + 1)
          break
        case backwardKey:
          event.preventDefault()
          moveTo(currentIndex - 1)
          break
        case 'Home':
          event.preventDefault()
          moveTo(0)
          break
        case 'End':
          event.preventDefault()
          moveTo(count - 1)
          break
      }
    },
    [orientation, moveTo, count],
  )

  const tabIndex = useCallback((index: number) => (index === clampedIndex ? 0 : -1), [clampedIndex])

  return { activeIndex: clampedIndex, registerItem, tabIndex, handleKeyDown }
}
