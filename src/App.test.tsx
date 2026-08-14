import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { getTodayKey, resolveDeviceTimezone } from './domain/date'

const { useAuthUserMock, useLedgersMock, createLedgerMock } = vi.hoisted(() => ({
  useAuthUserMock: vi.fn(),
  useLedgersMock: vi.fn(),
  createLedgerMock: vi.fn(),
}))

vi.mock('./hooks/useAuthUser', () => ({ useAuthUser: useAuthUserMock }))
vi.mock('./hooks/useLedgers', () => ({ useLedgers: useLedgersMock }))
vi.mock('./hooks/useTodayState', () => ({
  useTodayState: () => ({
    dateKey: '2026-08-10',
    effectiveState: 'did' as const,
    record: {},
    pending: false,
    error: null,
    setState: vi.fn(),
  }),
}))
vi.mock('./hooks/useMonthRecords', () => ({
  useMonthRecords: () => ({ records: new Map(), loading: false, error: null }),
}))
vi.mock('./data/ledger', () => ({
  createLedger: createLedgerMock,
  deleteLedger: vi.fn(),
  updateLedgerColor: vi.fn(),
  updateLedgerDefaultState: vi.fn(),
  updateLedgerName: vi.fn(),
  updateLedgerStateLabels: vi.fn(),
}))
vi.mock('./data/day', () => ({
  saveDailyRecord: vi.fn(),
}))
vi.mock('./lib/auth', () => ({
  signInWithGoogle: vi.fn(),
  signOutUser: vi.fn(),
}))

const { default: App } = await import('./App')

const ledger = {
  id: 'ledger-1',
  name: 'Worked out',
  defaultState: 'did' as const,
  timezone: 'UTC',
  startDate: '2026-08-10',
}

beforeEach(() => {
  window.localStorage.clear()
  createLedgerMock.mockReset().mockResolvedValue(undefined)
})

describe('App', () => {
  it('shows a neutral loading screen while auth resolves', () => {
    useAuthUserMock.mockReturnValue({ user: null, loading: true })
    useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: true, error: null, switchLedger: vi.fn() })

    render(<App />)

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('shows sign-in when unauthenticated', () => {
    useAuthUserMock.mockReturnValue({ user: null, loading: false })
    useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: true, error: null, switchLedger: vi.fn() })

    render(<App />)

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('shows setup when authenticated with no ledger yet', () => {
    useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: false, error: null, switchLedger: vi.fn() })

    render(<App />)

    expect(screen.getByText(/what are you tracking/i)).toBeInTheDocument()
  })

  it("a brand-new account's first ledger, created through Setup, never uses the legacy default id -- it enters the new per-ledger schema", async () => {
    useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: false, error: null, switchLedger: vi.fn() })

    render(<App />)

    fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
    fireEvent.click(screen.getByRole('radio', { name: 'I did it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const expectedTimezone = resolveDeviceTimezone()
    const expectedStartDate = getTodayKey(expectedTimezone)

    await vi.waitFor(() => {
      expect(createLedgerMock).toHaveBeenCalledWith('u1', {
        name: 'Reading',
        defaultState: 'did',
        timezone: expectedTimezone,
        startDate: expectedStartDate,
      })
    })
    // NewLedger has no id field at all -- creation always relies on
    // Firestore's own auto-id (see data/ledger.test.ts's dedicated test
    // proving that generated id is never LEGACY_LEDGER_ID), never a fixed
    // string the caller could pass through.
    const input = createLedgerMock.mock.calls.at(-1)?.[1]
    expect(input).not.toHaveProperty('id')
  })

  it('shows a neutral error state if ledgers fail to load', () => {
    useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    useLedgersMock.mockReturnValue({
      ledgers: [],
      activeLedger: null,
      loading: false,
      error: 'Could not load your ledgers. Try again.',
      switchLedger: vi.fn(),
    })

    render(<App />)

    expect(screen.getByRole('alert')).toHaveTextContent(/could not load your ledgers/i)
  })

  it('shows the home screen when authenticated with an active ledger', () => {
    useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    useLedgersMock.mockReturnValue({
      ledgers: [ledger],
      activeLedger: ledger,
      loading: false,
      error: null,
      switchLedger: vi.fn(),
    })

    render(<App />)

    expect(screen.getByText('Worked out')).toBeInTheDocument()
  })
})
