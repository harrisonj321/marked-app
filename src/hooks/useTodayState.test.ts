import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const subscribeDayMock = vi.fn()
const saveDailyRecordMock = vi.fn()

vi.mock('../data/day', () => ({
  subscribeDay: (...args: unknown[]) => subscribeDayMock(...args),
  saveDailyRecord: (...args: unknown[]) => saveDailyRecordMock(...args),
}))

const { useTodayState } = await import('./useTodayState')

const LA = 'America/Los_Angeles'
const UID = 'user-1'

function emitLatestSnapshot(
  record: { state?: 'did' | 'didnt'; note?: string; count?: number },
  hasPendingWrites = false,
) {
  const call = subscribeDayMock.mock.calls.at(-1) as
    | [string, string, (snapshot: { record: typeof record; hasPendingWrites: boolean }) => void]
    | undefined
  call?.[2]({ record, hasPendingWrites })
}

describe('useTodayState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T23:00:00-07:00'))
    subscribeDayMock.mockReset().mockReturnValue(() => {})
    saveDailyRecordMock.mockReset().mockResolvedValue(undefined)
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
    act(() => {
      vi.setSystemTime(new Date('2026-08-11T00:00:02-07:00'))
      vi.runOnlyPendingTimers()
    })
    expect(subscribeDayMock.mock.calls.at(-1)?.[1]).toBe('2026-08-11')
  })

  it('resolves the effective state from the default when nothing is stored', () => {
    const { result } = renderHook(() => useTodayState(UID, 'did', LA))
    act(() => emitLatestSnapshot({}))
    expect(result.current.effectiveState).toBe('did')
  })

  it('a toggle preserves the existing note and count', () => {
    const { result } = renderHook(() => useTodayState(UID, 'did', LA))
    act(() => emitLatestSnapshot({ note: 'Hotel gym', count: 3 }))

    act(() => {
      result.current.toggle()
    })

    expect(saveDailyRecordMock).toHaveBeenCalledWith(UID, '2026-08-10', {
      kind: 'set',
      state: 'didnt',
      note: 'Hotel gym',
    })
  })

  it('toggling away from did drops any stored count', () => {
    const { result } = renderHook(() => useTodayState(UID, 'did', LA))
    act(() => emitLatestSnapshot({ count: 5 }))

    act(() => {
      result.current.toggle()
    })

    const call = saveDailyRecordMock.mock.calls.at(-1)
    expect(call?.[2]).not.toHaveProperty('count')
  })

  it('a toggle after rollover writes the new day, never the previous one', () => {
    const { result } = renderHook(() => useTodayState(UID, 'did', LA))
    act(() => emitLatestSnapshot({}))

    act(() => {
      vi.setSystemTime(new Date('2026-08-11T00:00:02-07:00'))
      vi.runOnlyPendingTimers()
    })
    act(() => emitLatestSnapshot({}))

    act(() => {
      result.current.toggle()
    })

    expect(saveDailyRecordMock).toHaveBeenCalledWith(
      UID,
      '2026-08-11',
      expect.objectContaining({ state: 'didnt' }),
    )
    expect(saveDailyRecordMock).not.toHaveBeenCalledWith(
      UID,
      '2026-08-10',
      expect.anything(),
    )
  })

  it('exposes the raw record for the detail surface to consume', () => {
    const { result } = renderHook(() => useTodayState(UID, 'did', LA))
    act(() => emitLatestSnapshot({ note: 'Sick', count: 2, state: 'didnt' }))
    expect(result.current.record).toEqual({ note: 'Sick', count: 2, state: 'didnt' })
  })
})
