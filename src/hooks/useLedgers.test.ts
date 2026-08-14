import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ledger } from '../domain/ledger'

const subscribeLedgersMock = vi.fn()
const migrateLegacyTrackerIfNeededMock = vi.fn()
const subscribeActiveLedgerIdMock = vi.fn()
const setActiveLedgerIdMock = vi.fn()

vi.mock('../data/ledger', () => ({
  subscribeLedgers: (...args: unknown[]) => subscribeLedgersMock(...args),
  migrateLegacyTrackerIfNeeded: (...args: unknown[]) => migrateLegacyTrackerIfNeededMock(...args),
}))
vi.mock('../data/appSettings', () => ({
  subscribeActiveLedgerId: (...args: unknown[]) => subscribeActiveLedgerIdMock(...args),
  setActiveLedgerId: (...args: unknown[]) => setActiveLedgerIdMock(...args),
}))

const { useLedgers } = await import('./useLedgers')

const UID = 'user-1'

function ledger(id: string): Ledger {
  return { id, name: id, defaultState: 'did', timezone: 'UTC', startDate: '2026-01-01' }
}

function emitLedgers(next: Ledger[]) {
  const call = subscribeLedgersMock.mock.calls.at(-1) as
    | [string, (ledgers: Ledger[]) => void, () => void]
    | undefined
  call?.[1](next)
}

function emitActiveId(id: string | null) {
  const call = subscribeActiveLedgerIdMock.mock.calls.at(-1) as
    | [string, (id: string | null) => void, () => void]
    | undefined
  call?.[1](id)
}

beforeEach(() => {
  subscribeLedgersMock.mockReset().mockReturnValue(() => {})
  migrateLegacyTrackerIfNeededMock.mockReset().mockResolvedValue(null)
  subscribeActiveLedgerIdMock.mockReset().mockReturnValue(() => {})
  setActiveLedgerIdMock.mockReset().mockResolvedValue(undefined)
})

describe('useLedgers', () => {
  it('starts loading for a signed-in user', () => {
    const { result } = renderHook(() => useLedgers(UID))
    expect(result.current.loading).toBe(true)
    expect(result.current.activeLedger).toBeNull()
  })

  it('does not subscribe to anything when signed out, and is not loading', () => {
    const { result } = renderHook(() => useLedgers(null))
    expect(result.current.loading).toBe(false)
    expect(result.current.ledgers).toEqual([])
    expect(subscribeLedgersMock).not.toHaveBeenCalled()
    expect(subscribeActiveLedgerIdMock).not.toHaveBeenCalled()
  })

  it('resolves once both the ledger list and the active id have arrived', () => {
    const { result } = renderHook(() => useLedgers(UID))

    act(() => emitLedgers([ledger('a')]))
    expect(result.current.loading).toBe(true) // active id not resolved yet

    act(() => emitActiveId('a'))
    expect(result.current.loading).toBe(false)
    expect(result.current.activeLedger).toEqual(ledger('a'))
  })

  it('never attempts migration when the ledger list already has entries', () => {
    renderHook(() => useLedgers(UID))
    act(() => emitLedgers([ledger('a')]))
    act(() => emitActiveId('a'))

    expect(migrateLegacyTrackerIfNeededMock).not.toHaveBeenCalled()
  })

  it('runs migration once the ledger list is confirmed empty, and seeds the result locally without waiting for the subscription', async () => {
    migrateLegacyTrackerIfNeededMock.mockResolvedValue(ledger('default'))
    const { result } = renderHook(() => useLedgers(UID))

    act(() => emitLedgers([]))
    await act(async () => {})

    expect(migrateLegacyTrackerIfNeededMock).toHaveBeenCalledWith(UID)
    expect(result.current.ledgers).toEqual([ledger('default')])
  })

  it('resolves to no active ledger for a genuinely new account with nothing to migrate', async () => {
    migrateLegacyTrackerIfNeededMock.mockResolvedValue(null)
    const { result } = renderHook(() => useLedgers(UID))

    act(() => emitLedgers([]))
    await act(async () => {})
    act(() => emitActiveId(null))

    expect(result.current.loading).toBe(false)
    expect(result.current.ledgers).toEqual([])
    expect(result.current.activeLedger).toBeNull()
  })

  it('attempts migration only once even if the empty-ledgers effect could re-run', async () => {
    migrateLegacyTrackerIfNeededMock.mockResolvedValue(null)
    const { rerender } = renderHook(() => useLedgers(UID))

    act(() => emitLedgers([]))
    await act(async () => {})
    rerender()
    rerender()

    expect(migrateLegacyTrackerIfNeededMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the first ledger and persists the correction when the stored id points at nothing', () => {
    renderHook(() => useLedgers(UID))

    act(() => emitLedgers([ledger('a'), ledger('b')]))
    act(() => emitActiveId('deleted-elsewhere'))

    expect(setActiveLedgerIdMock).toHaveBeenCalledWith(UID, 'a')
  })

  it('does not write anything when the stored selection is already valid', () => {
    renderHook(() => useLedgers(UID))

    act(() => emitLedgers([ledger('a'), ledger('b')]))
    act(() => emitActiveId('b'))

    expect(setActiveLedgerIdMock).not.toHaveBeenCalled()
  })

  it('does not write a fallback when there are no ledgers to fall back to', async () => {
    migrateLegacyTrackerIfNeededMock.mockResolvedValue(null)
    renderHook(() => useLedgers(UID))

    act(() => emitLedgers([]))
    await act(async () => {})
    act(() => emitActiveId('stale'))

    expect(setActiveLedgerIdMock).not.toHaveBeenCalled()
  })

  it('switchLedger persists the new selection', () => {
    const { result } = renderHook(() => useLedgers(UID))
    act(() => emitLedgers([ledger('a'), ledger('b')]))
    act(() => emitActiveId('a'))

    act(() => result.current.switchLedger('b'))

    expect(setActiveLedgerIdMock).toHaveBeenCalledWith(UID, 'b')
  })

  it('surfaces an error when switching fails', async () => {
    setActiveLedgerIdMock.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useLedgers(UID))
    act(() => emitLedgers([ledger('a')]))
    act(() => emitActiveId('a'))

    await act(async () => {
      result.current.switchLedger('a')
    })

    expect(result.current.error).toBe('Could not switch ledgers. Try again.')
  })

  it('a fresh session (new hook instance, simulating a full app reload) checks migration independently rather than trusting any state from a previous instance', async () => {
    // This session finds nothing to migrate -- matching the now-fixed
    // real migrateLegacyTrackerIfNeeded once deleteLedger has already
    // retired the legacy tracker doc (see data/ledger.test.ts's
    // "deleted-ledger resurrection across a fresh session" test, which
    // proves that half of the guarantee against the real implementation).
    migrateLegacyTrackerIfNeededMock.mockResolvedValue(null)

    const first = renderHook(() => useLedgers(UID))
    act(() => emitLedgers([]))
    await act(async () => {})
    expect(migrateLegacyTrackerIfNeededMock).toHaveBeenCalledTimes(1)
    first.unmount()

    // A genuinely new hook instance -- no props/state carried over, the
    // same as a fresh page load or a sign-out/sign-in.
    migrateLegacyTrackerIfNeededMock.mockClear()
    const second = renderHook(() => useLedgers(UID))
    act(() => emitLedgers([]))
    await act(async () => {})

    expect(migrateLegacyTrackerIfNeededMock).toHaveBeenCalledTimes(1)
    expect(second.result.current.ledgers).toEqual([])
    expect(second.result.current.activeLedger).toBeNull()
  })

  it('resets and re-subscribes independently when uid changes to a different account', () => {
    const { result, rerender } = renderHook(({ uid }: { uid: string | null }) => useLedgers(uid), {
      initialProps: { uid: UID },
    })
    act(() => emitLedgers([ledger('a')]))
    act(() => emitActiveId('a'))
    expect(result.current.activeLedger).toEqual(ledger('a'))

    rerender({ uid: 'user-2' })

    expect(result.current.loading).toBe(true)
    expect(result.current.activeLedger).toBeNull()
    expect(subscribeLedgersMock).toHaveBeenLastCalledWith(
      'user-2',
      expect.any(Function),
      expect.any(Function),
    )
  })
})
