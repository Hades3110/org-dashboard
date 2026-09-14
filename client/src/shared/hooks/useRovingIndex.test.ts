import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRovingIndex } from './useRovingIndex'

function key(keyName: string) {
  return { key: keyName, preventDefault: vi.fn() } as unknown as Parameters<
    ReturnType<typeof useRovingIndex>['handleKeyDown']
  >[0]
}

function registerFakeItem(registerItem: ReturnType<typeof useRovingIndex>['registerItem'], index: number) {
  const focus = vi.fn()
  registerItem(index)({ focus } as unknown as HTMLElement)
  return focus
}

describe('useRovingIndex', () => {
  it('only the active index reports tabIndex 0', () => {
    const { result } = renderHook(() => useRovingIndex(3))

    expect(result.current.tabIndex(0)).toBe(0)
    expect(result.current.tabIndex(1)).toBe(-1)
    expect(result.current.tabIndex(2)).toBe(-1)
  })

  it('ArrowDown/ArrowRight advances, clamped at the last index', () => {
    const { result } = renderHook(() => useRovingIndex(3, 'vertical'))

    act(() => result.current.handleKeyDown(key('ArrowDown'), result.current.activeIndex))
    expect(result.current.activeIndex).toBe(1)

    act(() => result.current.handleKeyDown(key('ArrowDown'), result.current.activeIndex))
    act(() => result.current.handleKeyDown(key('ArrowDown'), result.current.activeIndex))
    expect(result.current.activeIndex).toBe(2) // clamped, not out of bounds
  })

  it('ArrowUp/ArrowLeft moves back, clamped at 0', () => {
    const { result } = renderHook(() => useRovingIndex(3, 'horizontal'))

    act(() => result.current.handleKeyDown(key('ArrowLeft'), result.current.activeIndex))
    expect(result.current.activeIndex).toBe(0)

    act(() => result.current.handleKeyDown(key('ArrowRight'), result.current.activeIndex))
    act(() => result.current.handleKeyDown(key('ArrowLeft'), result.current.activeIndex))
    expect(result.current.activeIndex).toBe(0)
  })

  it('Home jumps to 0, End jumps to the last index', () => {
    const { result } = renderHook(() => useRovingIndex(5))

    act(() => result.current.handleKeyDown(key('End'), result.current.activeIndex))
    expect(result.current.activeIndex).toBe(4)

    act(() => result.current.handleKeyDown(key('Home'), result.current.activeIndex))
    expect(result.current.activeIndex).toBe(0)
  })

  it('focuses the registered element for the new index synchronously', () => {
    const { result } = renderHook(() => useRovingIndex(3))
    const focusSecond = registerFakeItem(result.current.registerItem, 1)

    act(() => result.current.handleKeyDown(key('ArrowDown'), 0))

    expect(focusSecond).toHaveBeenCalledTimes(1)
  })

  it('clamps an out-of-range active index when the item count shrinks, without throwing', () => {
    const { result, rerender } = renderHook(({ count }) => useRovingIndex(count), { initialProps: { count: 5 } })

    act(() => result.current.handleKeyDown(key('End'), result.current.activeIndex))
    expect(result.current.activeIndex).toBe(4)

    expect(() => rerender({ count: 2 })).not.toThrow()
    expect(result.current.activeIndex).toBe(1)
  })
})
