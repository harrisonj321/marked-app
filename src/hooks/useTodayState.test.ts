import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DayState } from '../domain/tracker'

const subscribeDayMock = vi.fn()
const saveDailyRecordMock = vi.fn()

vi.mock('../data/day', () => ({
  subscribeDay: (...args: unknown[]) => subscribeDayMock(...args),
  saveDailyRecord: (...args: unknown[]) => saveDailyRecordMock(...args),
}))

const { useTodayState } = await import('./useTodayState')

const LA = 'America/Los_Angeles'
const UID = 'user-1'
const LEDGER_ID = 'ledger-1'

function emitLatestSnapshot(
  record: { state?: 'did' | 'didnt'; note?: string; count?: number },
  hasPendingWrites = false,
) {
  const call = subscribeDayMock.mock.calls.at(-1) as
    | [string, string, string, (snapshot: { record: typeof record; hasPendingWrites: boolean }) => void]
    | undefined
  call?.[3]({ record, hasPendingWrites })
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

  it("subscribes to today's document for the ledger's timezone", () => {
    renderHook(() => useTodayState(UID, LEDGER_ID, 'did', LA))
    expect(subscribeDayMock).toHaveBeenCalledTimes(1)
    expect(subscribeDayMock.mock.calls[0][1]).toBe(LEDGER_ID)
    expect(subscribeDayMock.mock.calls[0][2]).toBe('2026-08-10')
  })

  it('re-subscribes to the new day when local midnight passes', () => {
    renderHook(() => useTodayState(UID, LEDGER_ID, 'did', LA))
    act(() => {
      vi.setSystemTime(new Date('2026-08-11T00:00:02-07:00'))
      vi.runOnlyPendingTimers()
    })
    expect(subscribeDayMock.mock.calls.at(-1)?.[2]).toBe('2026-08-11')
  })

  it('resolves the effective state from the default when nothing is stored', () => {
    const { result } = renderHook(() => useTodayState(UID, LEDGER_ID, 'did', LA))
    act(() => emitLatestSnapshot({}))
    expect(result.current.effectiveState).toBe('did')
  })

  it('selecting the state that is already current writes nothing', () => {
    const { result } = renderHook(() => useTodayState(UID, LEDGER_ID, 'did', LA))
    act(() => emitLatestSnapshot({}))

    act(() => {
      result.current.setState('did')
    })

    expect(saveDailyRecordMock).not.toHaveBeenCalled()
  })

  it('a state change preserves the existing note and count', () => {
    const { result } = renderHook(() => useTodayState(UID, LEDGER_ID, 'did', LA))
    act(() => emitLatestSnapshot({ note: 'Hotel gym', count: 3 }))

    act(() => {
      result.current.setState('didnt')
    })

    expect(saveDailyRecordMock).toHaveBeenCalledWith(UID, LEDGER_ID, '2026-08-10', {
      kind: 'set',
      state: 'didnt',
      note: 'Hotel gym',
    })
  })

  it('changing away from did drops any stored count', () => {
    const { result } = renderHook(() => useTodayState(UID, LEDGER_ID, 'did', LA))
    act(() => emitLatestSnapshot({ count: 5 }))

    act(() => {
      result.current.setState('didnt')
    })

    const call = saveDailyRecordMock.mock.calls.at(-1)
    expect(call?.[3]).not.toHaveProperty('count')
  })

  it('returning an override to the default deletes the day document', () => {
    const { result } = renderHook(() => useTodayState(UID, LEDGER_ID, 'did', LA))
    act(() => emitLatestSnapshot({ state: 'didnt' }))

    act(() => {
      result.current.setState('did')
    })

    expect(saveDailyRecordMock).toHaveBeenCalledWith(UID, LEDGER_ID, '2026-08-10', { kind: 'delete' })
  })

  it('a state change after rollover writes the new day, never the previous one', () => {
    const { result } = renderHook(() => useTodayState(UID, LEDGER_ID, 'did', LA))
    act(() => emitLatestSnapshot({}))

    act(() => {
      vi.setSystemTime(new Date('2026-08-11T00:00:02-07:00'))
      vi.runOnlyPendingTimers()
    })
    act(() => emitLatestSnapshot({}))

    act(() => {
      result.current.setState('didnt')
    })

    expect(saveDailyRecordMock).toHaveBeenCalledWith(
      UID,
      LEDGER_ID,
      '2026-08-11',
      expect.objectContaining({ state: 'didnt' }),
    )
    expect(saveDailyRecordMock).not.toHaveBeenCalledWith(
      UID,
      LEDGER_ID,
      '2026-08-10',
      expect.anything(),
    )
  })

  it('re-resolves an untouched day when the ledger default changes, without writing', () => {
    const { result, rerender } = renderHook(
      ({ defaultState }: { defaultState: DayState }) =>
        useTodayState(UID, LEDGER_ID, defaultState, LA),
      { initialProps: { defaultState: 'did' } as { defaultState: DayState } },
    )
    act(() => emitLatestSnapshot({}))
    expect(result.current.effectiveState).toBe('did')

    rerender({ defaultState: 'didnt' })

    expect(result.current.effectiveState).toBe('didnt')
    expect(subscribeDayMock).toHaveBeenCalledTimes(1)
    expect(saveDailyRecordMock).not.toHaveBeenCalled()
  })

  it('leaves an explicit override untouched when the ledger default changes', () => {
    const { result, rerender } = renderHook(
      ({ defaultState }: { defaultState: DayState }) =>
        useTodayState(UID, LEDGER_ID, defaultState, LA),
      { initialProps: { defaultState: 'did' } as { defaultState: DayState } },
    )
    act(() => emitLatestSnapshot({ state: 'didnt', note: 'Sick' }))

    rerender({ defaultState: 'didnt' })

    expect(result.current.effectiveState).toBe('didnt')
    expect(result.current.record).toEqual({ state: 'didnt', note: 'Sick' })
    expect(saveDailyRecordMock).not.toHaveBeenCalled()
  })

  it('a state change after the default changes is normalized against the new default', () => {
    const { result, rerender } = renderHook(
      ({ defaultState }: { defaultState: DayState }) =>
        useTodayState(UID, LEDGER_ID, defaultState, LA),
      { initialProps: { defaultState: 'did' } as { defaultState: DayState } },
    )
    act(() => emitLatestSnapshot({}))

    rerender({ defaultState: 'didnt' })

    act(() => {
      result.current.setState('did')
    })

    expect(saveDailyRecordMock).toHaveBeenCalledWith(UID, LEDGER_ID, '2026-08-10', {
      kind: 'set',
      state: 'did',
    })
  })

  it('exposes the raw record for the detail surface to consume', () => {
    const { result } = renderHook(() => useTodayState(UID, LEDGER_ID, 'did', LA))
    act(() => emitLatestSnapshot({ note: 'Sick', count: 2, state: 'didnt' }))
    expect(result.current.record).toEqual({ note: 'Sick', count: 2, state: 'didnt' })
  })

  it('re-subscribes when the ledger changes, resetting record state', () => {
    const { result, rerender } = renderHook(
      ({ ledgerId }: { ledgerId: string }) => useTodayState(UID, ledgerId, 'did', LA),
      { initialProps: { ledgerId: LEDGER_ID } },
    )
    act(() => emitLatestSnapshot({ state: 'didnt', note: 'Sick' }))
    expect(result.current.record).toEqual({ state: 'didnt', note: 'Sick' })

    rerender({ ledgerId: 'ledger-2' })

    expect(subscribeDayMock).toHaveBeenCalledTimes(2)
    expect(subscribeDayMock.mock.calls[1][1]).toBe('ledger-2')
    expect(result.current.record).toEqual({})
  })
})
