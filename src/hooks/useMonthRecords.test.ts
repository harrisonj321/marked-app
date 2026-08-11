import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const subscribeMonthMock = vi.fn()

vi.mock('../data/day', () => ({
  subscribeMonth: (...args: unknown[]) => subscribeMonthMock(...args),
}))

const { useMonthRecords } = await import('./useMonthRecords')

const UID = 'user-1'

function emitLatestRecords(records: Map<string, unknown>) {
  const call = subscribeMonthMock.mock.calls.at(-1) as
    | [string, string, string, (records: Map<string, unknown>) => void]
    | undefined
  call?.[3](records)
}

describe('useMonthRecords', () => {
  beforeEach(() => {
    subscribeMonthMock.mockReset().mockReturnValue(() => {})
  })

  it('queries the exact first/last date-key range for the visible month', () => {
    renderHook(() => useMonthRecords(UID, { year: 2026, month: 2 }))
    expect(subscribeMonthMock).toHaveBeenCalledWith(
      UID,
      '2026-02-01',
      '2026-02-28',
      expect.any(Function),
      expect.any(Function),
    )
  })

  it('starts in a loading state and resolves once data arrives', () => {
    const { result } = renderHook(() => useMonthRecords(UID, { year: 2026, month: 8 }))
    expect(result.current.loading).toBe(true)

    act(() => emitLatestRecords(new Map([['2026-08-10', { state: 'didnt' }]])))

    expect(result.current.loading).toBe(false)
    expect(result.current.records.get('2026-08-10')).toEqual({ state: 'didnt' })
  })

  it('re-subscribes with a new range when the visible month changes', () => {
    const { rerender } = renderHook(
      ({ month }: { month: number }) => useMonthRecords(UID, { year: 2026, month }),
      { initialProps: { month: 8 } },
    )
    expect(subscribeMonthMock).toHaveBeenCalledTimes(1)

    rerender({ month: 9 })

    expect(subscribeMonthMock).toHaveBeenCalledTimes(2)
    expect(subscribeMonthMock.mock.calls[1][1]).toBe('2026-09-01')
  })

  it('does not query when there is no signed-in user', () => {
    renderHook(() => useMonthRecords(null, { year: 2026, month: 8 }))
    expect(subscribeMonthMock).not.toHaveBeenCalled()
  })
})
