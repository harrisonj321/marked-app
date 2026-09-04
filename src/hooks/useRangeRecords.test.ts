import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const subscribeMonthMock = vi.fn()

vi.mock('../data/day', () => ({
  subscribeMonth: (...args: unknown[]) => subscribeMonthMock(...args),
}))

const { useRangeRecords } = await import('./useRangeRecords')

const UID = 'user-1'
const LEDGER_ID = 'ledger-1'

function emitLatestRecords(records: Map<string, unknown>) {
  const call = subscribeMonthMock.mock.calls.at(-1) as
    | [string, string, string, string, (records: Map<string, unknown>) => void]
    | undefined
  call?.[4](records)
}

describe('useRangeRecords', () => {
  beforeEach(() => {
    subscribeMonthMock.mockReset().mockReturnValue(() => {})
  })

  it('queries the exact given start/end date-key range, scoped to the ledger', () => {
    renderHook(() => useRangeRecords(UID, LEDGER_ID, '2026-02-01', '2026-02-28'))
    expect(subscribeMonthMock).toHaveBeenCalledWith(
      UID,
      LEDGER_ID,
      '2026-02-01',
      '2026-02-28',
      expect.any(Function),
      expect.any(Function),
    )
  })

  it('starts in a loading state and resolves once data arrives', () => {
    const { result } = renderHook(() => useRangeRecords(UID, LEDGER_ID, '2026-08-01', '2026-08-31'))
    expect(result.current.loading).toBe(true)

    act(() => emitLatestRecords(new Map([['2026-08-10', { state: 'didnt' }]])))

    expect(result.current.loading).toBe(false)
    expect(result.current.records.get('2026-08-10')).toEqual({ state: 'didnt' })
  })

  it('re-subscribes with a new range when the range widens', () => {
    const { rerender } = renderHook(
      ({ startKey }: { startKey: string }) =>
        useRangeRecords(UID, LEDGER_ID, startKey, '2026-08-31'),
      { initialProps: { startKey: '2026-08-01' } },
    )
    expect(subscribeMonthMock).toHaveBeenCalledTimes(1)

    rerender({ startKey: '2026-06-01' })

    expect(subscribeMonthMock).toHaveBeenCalledTimes(2)
    expect(subscribeMonthMock.mock.calls[1][2]).toBe('2026-06-01')
  })

  it('re-subscribes when the ledger changes', () => {
    const { rerender } = renderHook(
      ({ ledgerId }: { ledgerId: string }) =>
        useRangeRecords(UID, ledgerId, '2026-08-01', '2026-08-31'),
      { initialProps: { ledgerId: LEDGER_ID } },
    )
    expect(subscribeMonthMock).toHaveBeenCalledTimes(1)

    rerender({ ledgerId: 'ledger-2' })

    expect(subscribeMonthMock).toHaveBeenCalledTimes(2)
    expect(subscribeMonthMock.mock.calls[1][1]).toBe('ledger-2')
  })

  it('does not query when there is no signed-in user', () => {
    renderHook(() => useRangeRecords(null, LEDGER_ID, '2026-08-01', '2026-08-31'))
    expect(subscribeMonthMock).not.toHaveBeenCalled()
  })

  it('does not query when there is no ledger', () => {
    renderHook(() => useRangeRecords(UID, null, '2026-08-01', '2026-08-31'))
    expect(subscribeMonthMock).not.toHaveBeenCalled()
  })
})
