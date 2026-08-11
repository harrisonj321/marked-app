import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalDateKey } from './useLocalDateKey'

const LA = 'America/Los_Angeles'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

describe('useLocalDateKey', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the current local date key for the given timezone', () => {
    vi.setSystemTime(new Date('2026-08-10T12:00:00Z'))
    const { result } = renderHook(() => useLocalDateKey(LA))
    expect(result.current).toBe('2026-08-10')
  })

  it('is timezone-aware: does not roll over merely because UTC crossed midnight', () => {
    // 11:55 PM Aug 10 in Los Angeles (PDT) is already Aug 11 in UTC.
    vi.setSystemTime(new Date('2026-08-11T06:55:00Z'))
    const { result } = renderHook(() => useLocalDateKey(LA))
    expect(result.current).toBe('2026-08-10')
  })

  it('moves from the old date key to the new one when local midnight passes while open', () => {
    vi.setSystemTime(new Date('2026-08-10T23:59:58-07:00'))
    const { result } = renderHook(() => useLocalDateKey(LA))
    expect(result.current).toBe('2026-08-10')

    act(() => {
      vi.setSystemTime(new Date('2026-08-11T00:00:02-07:00'))
      vi.runOnlyPendingTimers()
    })

    expect(result.current).toBe('2026-08-11')
  })

  it('reconciles to the current date on visibilitychange even if the timer never fired', () => {
    vi.setSystemTime(new Date('2026-08-10T23:00:00-07:00'))
    const { result } = renderHook(() => useLocalDateKey(LA))
    expect(result.current).toBe('2026-08-10')

    act(() => {
      setVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Time passes across midnight while backgrounded; the scheduled
    // timeout is deliberately never run here, simulating a browser
    // throttling/suspending timers for a hidden/sleeping app.
    act(() => {
      vi.setSystemTime(new Date('2026-08-11T09:15:00-07:00'))
      setVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current).toBe('2026-08-11')
  })

  it('also reconciles on window focus', () => {
    vi.setSystemTime(new Date('2026-08-10T23:00:00-07:00'))
    const { result } = renderHook(() => useLocalDateKey(LA))
    expect(result.current).toBe('2026-08-10')

    act(() => {
      vi.setSystemTime(new Date('2026-08-11T09:15:00-07:00'))
      window.dispatchEvent(new Event('focus'))
    })

    expect(result.current).toBe('2026-08-11')
  })
})
