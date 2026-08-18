import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { getTodayKey, resolveDeviceTimezone } from './domain/date'
import { hasSeenOnboardingIntro, saveOnboardingIntroSeen } from './data/onboarding'

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
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
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
  // Every test outside the "pre-auth onboarding" block is exercising
  // ordinary boot behavior that has nothing to do with the orientation
  // screen itself, so it renders as a device that has already completed it
  // -- the steady state -- rather than incidentally colliding with the
  // auto-shown intro on a bare device with no record. See Home.test.tsx's
  // renderSettledHome for the identical convention with the in-Home tour.
  saveOnboardingIntroSeen('completed')
})

describe('App', () => {
  it('shows a neutral loading screen while auth resolves', () => {
    useAuthUserMock.mockReturnValue({ user: null, loading: true })
    useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: true, error: null, switchLedger: vi.fn() })

    render(<App />)

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('shows a neutral loading screen while auth resolves even if this device has never seen the pre-auth orientation screen', () => {
    window.localStorage.clear()
    useAuthUserMock.mockReturnValue({ user: null, loading: true })
    useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: true, error: null, switchLedger: vi.fn() })

    render(<App />)

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('shows sign-in when unauthenticated and this device has already completed the pre-auth orientation', () => {
    useAuthUserMock.mockReturnValue({ user: null, loading: false })
    useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: true, error: null, switchLedger: vi.fn() })

    render(<App />)

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('passes a Google redirect error along to the sign-in screen', () => {
    useAuthUserMock.mockReturnValue({
      user: null,
      loading: false,
      authError: 'Sign-in did not complete. Try again.',
    })
    useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: true, error: null, switchLedger: vi.fn() })

    render(<App />)

    expect(screen.getByRole('alert')).toHaveTextContent(/sign-in did not complete/i)
  })

  it('never shows ledger creation to a signed-out user, even if useLedgers reports no ledgers', () => {
    useAuthUserMock.mockReturnValue({ user: null, loading: false })
    useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: false, error: null, switchLedger: vi.fn() })

    render(<App />)

    expect(screen.queryByText(/what are you tracking/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  describe('pre-auth onboarding', () => {
    beforeEach(() => {
      window.localStorage.clear()
      useAuthUserMock.mockReturnValue({ user: null, loading: false })
      useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: true, error: null, switchLedger: vi.fn() })
    })

    it('shows the orientation screen before sign-in for a first-time visitor on a fresh device', () => {
      render(<App />)

      expect(screen.getByText(/not a habit tracker/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()
    })

    it('moves on to sign-in once the visitor finishes the orientation screen, and remembers that for next time', () => {
      render(<App />)

      fireEvent.click(screen.getByRole('button', { name: 'Noted.' }))

      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
      expect(hasSeenOnboardingIntro()).toBe(true)
    })

    it('moves on to sign-in when the visitor skips the orientation screen instead, and still remembers that', () => {
      render(<App />)

      fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
      expect(hasSeenOnboardingIntro()).toBe(true)
    })

    it('does not show the orientation screen again for a returning signed-out visitor who already saw it on this device', () => {
      saveOnboardingIntroSeen('skipped')

      render(<App />)

      expect(screen.queryByText(/not a habit tracker/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    })

    it('never shows the orientation screen to an already-authenticated user, regardless of this device\'s record', () => {
      useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: false, error: null, switchLedger: vi.fn() })

      render(<App />)

      expect(screen.queryByText(/not a habit tracker/i)).not.toBeInTheDocument()
      expect(screen.getByText(/what are you tracking/i)).toBeInTheDocument()
    })
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
