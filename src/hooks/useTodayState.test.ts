import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const subscribeDayMock = vi.fn()
const setDayOverrideMock = vi.fn()
const clearDayOverrideMock = vi.fn()

vi.mock('../data/day', () => ({
  subscribeDay: (...args: unknown[]) => subscribeDayMock(...args),
  setDayOverride: (...args: unknown[]) => setDayOverrideMock(...args),
  clearDayOverride: (...args: unknown[]) => clearDayOverrideMock(...args),
}))

const { useTodayState } = await import('./useTodayState')

const LA = 'America/Los_Angeles'
const UID = 'user-1'

function emitLatestSnapshot(state: 'did' | 'didnt' | null, hasPendingWrites = false) {
  const call = subscribeDayMock.mock.calls.at(-1) as
    | [string, string, (snapshot: { state: typeof state; hasPendingWrites: boolean }) => void]
    | undefined
  call?.[2]({ state, hasPendingWrites })
}

describe('useTodayState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T23:00:00-07:00'))
    subscribeDayMock.mockReset().mockReturnValue(() => {})
    setDayOverrideMock.mockReset().mockResolvedValue(undefined)
    clearDayOverrideMock.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("subscribes to today's document for the tracker's timezone", () => {
    renderHook(() => useTodayState(UID, 'did', LA))
    expect(subscribeDayMock).toHaveBeenCalledTimes(1)
    expect(subscribeDayMock.mock.calls[0][1]).toBe('2026-08-10')
  })

  it('re-subscribes to the new day when local midnight passes', () => {
    renderHook(() => useTodayState(UID, 'did', LA))
    expect(subscribeDayMock.mock.calls[0][1]).toBe('2026-08-10')

    act(() => {
      vi.setSystemTime(new Date('2026-08-11T00:00:02-07:00'))
      vi.runOnlyPendingTimers()
    })

    const lastCall = subscribeDayMock.mock.calls.at(-1)
    expect(lastCall?.[1]).toBe('2026-08-11')
  })

  it('returns to a loading/derived state while the new subscription resolves after rollover', () => {
    const { result } = renderHook(() => useTodayState(UID, 'did', LA))
    act(() => emitLatestSnapshot('didnt'))
    expect(result.current.effectiveState).toBe('didnt')

    act(() => {
      vi.setSystemTime(new Date('2026-08-11T00:00:02-07:00'))
      vi.runOnlyPendingTimers()
    })

    // Yesterday's override must not leak into the new day before the new
    // subscription reports back.
    expect(result.current.effectiveState).toBeNull()

    act(() => emitLatestSnapshot(null))
    expect(result.current.effectiveState).toBe('did')
  })

  it('a toggle after rollover writes the new day, never the previous one', () => {
    const { result } = renderHook(() => useTodayState(UID, 'did', LA))
    act(() => emitLatestSnapshot(null))

    act(() => {
      vi.setSystemTime(new Date('2026-08-11T00:00:02-07:00'))
      vi.runOnlyPendingTimers()
    })
    act(() => emitLatestSnapshot(null))

    act(() => {
      result.current.toggle()
    })

    expect(setDayOverrideMock).toHaveBeenCalledWith(UID, '2026-08-11', 'didnt')
    expect(setDayOverrideMock).not.toHaveBeenCalledWith(
      UID,
      '2026-08-10',
      expect.anything(),
    )
    expect(clearDayOverrideMock).not.toHaveBeenCalledWith(UID, '2026-08-10')
  })

  it('a toggle back to default after rollover clears the new day, not the previous one', () => {
    const { result } = renderHook(() => useTodayState(UID, 'did', LA))
    act(() => emitLatestSnapshot(null))

    act(() => {
      vi.setSystemTime(new Date('2026-08-11T00:00:02-07:00'))
      vi.runOnlyPendingTimers()
    })
    act(() => emitLatestSnapshot('didnt'))

    act(() => {
      result.current.toggle()
    })

    expect(clearDayOverrideMock).toHaveBeenCalledWith(UID, '2026-08-11')
    expect(clearDayOverrideMock).not.toHaveBeenCalledWith(UID, '2026-08-10')
  })

  it('remains timezone-aware: UTC already past midnight does not retarget a still-current LA day', () => {
    // UTC has already crossed into Aug 11, but it is still 10 PM Aug 10 in LA.
    vi.setSystemTime(new Date('2026-08-11T05:00:00Z'))
    renderHook(() => useTodayState(UID, 'did', LA))
    expect(subscribeDayMock.mock.calls[0][1]).toBe('2026-08-10')
  })
})
