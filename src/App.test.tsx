import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { getTodayKey, resolveDeviceTimezone } from './domain/date'
import { hasCompletedOnboarding, saveOnboardingCompletion } from './data/onboarding'

const { useAuthUserMock, useLedgersMock, createLedgerMock, consumeGoogleRedirectPendingMock } = vi.hoisted(() => ({
  useAuthUserMock: vi.fn(),
  useLedgersMock: vi.fn(),
  createLedgerMock: vi.fn(),
  consumeGoogleRedirectPendingMock: vi.fn(),
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
vi.mock('./data/account', () => ({
  deleteAllUserData: vi.fn(),
}))
vi.mock('./lib/auth', () => ({
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signOutUser: vi.fn(),
  consumeGoogleRedirectPending: consumeGoogleRedirectPendingMock,
  primaryProviderId: (user: { providerData?: { providerId: string }[] }) =>
    user.providerData?.[0]?.providerId ?? 'password',
  reauthenticateWithGoogle: vi.fn(),
  reauthenticateWithPassword: vi.fn(),
  deleteAuthAccount: vi.fn(),
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
  // jsdom has no real <dialog> support -- LedgerSwitcherSheet can now
  // render for real here (a zero-ledger authenticated user auto-opens it),
  // same stub every other test file that renders it directly already uses.
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  })
  window.localStorage.clear()
  createLedgerMock.mockReset().mockResolvedValue(undefined)
  // Every test is a genuine fresh open/reload, not a Google-redirect
  // return, unless a test explicitly says otherwise -- see the "returning
  // from a Google redirect" tests below.
  consumeGoogleRedirectPendingMock.mockReset().mockReturnValue(false)
  // Every test outside the "pre-auth onboarding orientation" block is
  // exercising ordinary boot behavior that has nothing to do with the
  // orientation itself, so it renders as a device that has already
  // completed it -- the steady state -- rather than incidentally colliding
  // with the auto-shown orientation on a bare device with no record.
  saveOnboardingCompletion('completed')
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

  describe('pre-auth onboarding orientation', () => {
    beforeEach(() => {
      window.localStorage.clear()
      useAuthUserMock.mockReturnValue({ user: null, loading: false })
      useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: true, error: null, switchLedger: vi.fn() })
    })

    // The intro's primary action reads "Marked."; coach steps advance with
    // Next and the last one closes with Done -- see OnboardingTour.test.tsx.
    //
    // The staged orientation holds the welcome screen while its exit fade
    // plays and holds the last scene through its closing beat, releasing
    // each when its animation reports done. jsdom never fires animation
    // events on its own (and its matchMedia leaves motion enabled), so
    // this drives them the way a motion-enabled browser would.
    function fireAnimationEnd(element: Element, animationName: string) {
      const event = new Event('animationend', { bubbles: true }) as Event & { animationName: string }
      event.animationName = animationName
      fireEvent(element, event)
    }

    function clickNext() {
      const button = screen.getByRole('button', { name: /^(Marked\.|Next|Done)$/ })
      const label = button.textContent
      fireEvent.click(button)
      if (label === 'Marked.') {
        fireAnimationEnd(document.querySelector('.onboarding-intro')!, 'onboarding-intro-leave')
      }
      if (label === 'Done') {
        fireAnimationEnd(document.querySelector('.onboarding-coach')!, 'onboarding-close')
      }
    }

    // Walks the entire orientation from the welcome screen through all four
    // coach marks to completion. No install step is exercised here: jsdom's
    // matchMedia/UA defaults make OnboardingTour's showInstallStep false,
    // the same baseline OnboardingTour.test.tsx's own mockPlatform() uses.
    function walkFullOrientation() {
      clickNext() // welcome -> coach-today
      clickNext() // coach-today -> coach-calendar
      clickNext() // coach-calendar -> coach-customize
      clickNext() // coach-customize -> coach-ledger
      clickNext() // coach-ledger -> finish (Done)
    }

    it('shows the full onboarding/orientation experience before sign-in for a first-time visitor on a fresh device', () => {
      render(<App />)

      expect(screen.getByText(/not a habit tracker/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()
    })

    it('keeps sign-in unreachable until the orientation is completed or skipped -- every coach mark still precedes it', () => {
      render(<App />)

      clickNext() // welcome -> coach-today
      expect(screen.getByText(/flip today's mark/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()

      clickNext() // coach-today -> coach-calendar
      expect(screen.getByText(/tap a past day to correct it/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()

      clickNext() // coach-calendar -> coach-customize
      expect(screen.getByText(/rename the two states/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()

      clickNext() // coach-customize -> coach-ledger
      expect(screen.getByText(/tap the name to switch ledgers/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()
    })

    it('completing the full orientation leads to sign-in, and remembers that for next time', () => {
      render(<App />)

      walkFullOrientation()

      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
      expect(hasCompletedOnboarding()).toBe(true)
    })

    it('skipping the orientation at any point leads to sign-in instead, and still remembers that', () => {
      render(<App />)

      clickNext() // welcome -> coach-today
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
      expect(hasCompletedOnboarding()).toBe(true)
    })

    it('does not show the orientation again for a returning signed-out visitor who already completed it on this device -- straight to sign-in', () => {
      saveOnboardingCompletion('skipped')

      render(<App />)

      expect(screen.queryByText(/not a habit tracker/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    })

    it('never shows the orientation to an already-authenticated user, regardless of this device\'s record', () => {
      useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
      useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: false, error: null, switchLedger: vi.fn() })

      render(<App />)

      expect(screen.queryByText(/not a habit tracker/i)).not.toBeInTheDocument()
      expect(screen.getByText(/what are you tracking/i)).toBeInTheDocument()
    })

    it('a new account reaches first-ledger creation after completing orientation and then authenticating', () => {
      const { rerender } = render(<App />)
      walkFullOrientation()
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()

      // Simulate a successful sign-in on the same device: still no ledgers,
      // exactly what a brand-new account looks like right after auth.
      useAuthUserMock.mockReturnValue({ user: { uid: 'new-user' }, loading: false })
      useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: false, error: null, switchLedger: vi.fn() })
      rerender(<App />)

      expect(screen.getByText(/what are you tracking/i)).toBeInTheDocument()
    })

    it('does not replay any part of onboarding after authenticating, for someone who just completed the pre-auth orientation', () => {
      const { rerender } = render(<App />)
      walkFullOrientation()

      useAuthUserMock.mockReturnValue({ user: { uid: 'new-user' }, loading: false })
      useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: false, error: null, switchLedger: vi.fn() })
      rerender(<App />)

      expect(screen.queryByText(/not a habit tracker/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/flip today's mark/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
    })
  })

  describe('VITE_FORCE_ONBOARDING', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    // signInWithRedirect is a full navigation away and back -- a fresh page
    // load with no in-memory trace of the onboarding this same visitor sat
    // through moments earlier. consumeGoogleRedirectPending (see lib/auth)
    // is what lets this one boot tell itself apart from a genuinely fresh
    // open, so it must not be re-forced into onboarding just because it
    // returned from Google.
    describe('returning from a Google redirect', () => {
      it('does not restart onboarding when the boot is a Google-redirect return, even though the flag is enabled', () => {
        vi.stubEnv('VITE_FORCE_ONBOARDING', 'true')
        consumeGoogleRedirectPendingMock.mockReturnValue(true)
        saveOnboardingCompletion('completed')
        useAuthUserMock.mockReturnValue({ user: null, loading: false })
        useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: true, error: null, switchLedger: vi.fn() })

        render(<App />)

        expect(screen.queryByText(/not a habit tracker/i)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
      })

      it('completing Google auth on that same boot continues straight into the app -- no onboarding/sign-in loop', () => {
        vi.stubEnv('VITE_FORCE_ONBOARDING', 'true')
        consumeGoogleRedirectPendingMock.mockReturnValue(true)
        saveOnboardingCompletion('completed')
        useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
        useLedgersMock.mockReturnValue({
          ledgers: [ledger],
          activeLedger: ledger,
          loading: false,
          error: null,
          switchLedger: vi.fn(),
        })

        render(<App />)

        expect(screen.queryByText(/not a habit tracker/i)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()
        expect(screen.getByText('Worked out')).toBeInTheDocument()
      })

      it('a subsequent genuinely fresh reload/open still shows onboarding again while the flag remains enabled', () => {
        vi.stubEnv('VITE_FORCE_ONBOARDING', 'true')
        // The redirect-return boot above already consumed its one-shot
        // marker; this boot is a separate, ordinary fresh load.
        consumeGoogleRedirectPendingMock.mockReturnValue(false)
        saveOnboardingCompletion('completed')
        useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
        useLedgersMock.mockReturnValue({
          ledgers: [ledger],
          activeLedger: ledger,
          loading: false,
          error: null,
          switchLedger: vi.fn(),
        })

        render(<App />)

        expect(screen.getByText(/not a habit tracker/i)).toBeInTheDocument()
        expect(screen.queryByText('Worked out')).not.toBeInTheDocument()
      })
    })

    it('shows the orientation even though this device already completed it, when the flag is enabled', () => {
      vi.stubEnv('VITE_FORCE_ONBOARDING', 'true')
      saveOnboardingCompletion('completed')
      useAuthUserMock.mockReturnValue({ user: null, loading: false })
      useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: true, error: null, switchLedger: vi.fn() })

      render(<App />)

      expect(screen.getByText(/not a habit tracker/i)).toBeInTheDocument()
    })

    it('completing the orientation under the flag still proceeds to sign-in for this session, without looping back', () => {
      vi.stubEnv('VITE_FORCE_ONBOARDING', 'true')
      saveOnboardingCompletion('completed')
      useAuthUserMock.mockReturnValue({ user: null, loading: false })
      useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: true, error: null, switchLedger: vi.fn() })

      render(<App />)

      fireEvent.click(screen.getByRole('button', { name: /^Marked\.$/ }))
      fireEvent(document.querySelector('.onboarding-intro')!, (() => {
        const event = new Event('animationend', { bubbles: true }) as Event & { animationName: string }
        event.animationName = 'onboarding-intro-leave'
        return event
      })())
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
      expect(screen.queryByText(/not a habit tracker/i)).not.toBeInTheDocument()
    })

    it('a simulated fresh reload (fresh mount) shows the orientation again while the flag remains enabled', () => {
      vi.stubEnv('VITE_FORCE_ONBOARDING', 'true')
      saveOnboardingCompletion('completed')
      useAuthUserMock.mockReturnValue({ user: null, loading: false })
      useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: true, error: null, switchLedger: vi.fn() })

      const first = render(<App />)
      fireEvent.click(first.getByRole('button', { name: 'Skip' }))
      expect(first.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
      first.unmount()

      // hasCompletedOnboarding() is true here (skip persisted it normally),
      // but a fresh mount under the flag still ignores that stored record.
      expect(hasCompletedOnboarding()).toBe(true)
      const second = render(<App />)
      expect(second.getByText(/not a habit tracker/i)).toBeInTheDocument()
    })

    it('leaves normal persisted behavior unchanged when the flag is disabled', () => {
      saveOnboardingCompletion('completed')
      useAuthUserMock.mockReturnValue({ user: null, loading: false })
      useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: true, error: null, switchLedger: vi.fn() })

      render(<App />)

      expect(screen.queryByText(/not a habit tracker/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    })

    // "Every fresh load" is literal: it must also apply to a load that
    // restores an already-authenticated session, not just a signed-out
    // visitor -- unlike the ordinary (flag-off) boot order, where an
    // authenticated session always skips the pre-auth orientation outright.
    describe('with an already-authenticated session', () => {
      function skipOrientation() {
        fireEvent.click(screen.getByRole('button', { name: /^Marked\.$/ }))
        const event = new Event('animationend', { bubbles: true }) as Event & { animationName: string }
        event.animationName = 'onboarding-intro-leave'
        fireEvent(document.querySelector('.onboarding-intro')!, event)
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
      }

      it('shows the orientation first, even though this device already completed it and the session restores as signed in', () => {
        vi.stubEnv('VITE_FORCE_ONBOARDING', 'true')
        saveOnboardingCompletion('completed')
        useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
        useLedgersMock.mockReturnValue({
          ledgers: [ledger],
          activeLedger: ledger,
          loading: false,
          error: null,
          switchLedger: vi.fn(),
        })

        render(<App />)

        expect(screen.getByText(/not a habit tracker/i)).toBeInTheDocument()
        expect(screen.queryByText('Worked out')).not.toBeInTheDocument()
      })

      it('completing/skipping the orientation continues the already-authenticated session straight to Home, not SignIn', () => {
        vi.stubEnv('VITE_FORCE_ONBOARDING', 'true')
        saveOnboardingCompletion('completed')
        useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
        useLedgersMock.mockReturnValue({
          ledgers: [ledger],
          activeLedger: ledger,
          loading: false,
          error: null,
          switchLedger: vi.fn(),
        })

        render(<App />)
        skipOrientation()

        expect(screen.getByText('Worked out')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()
        expect(screen.queryByText(/not a habit tracker/i)).not.toBeInTheDocument()
      })

      it('a fresh reload with the same authenticated session shows the orientation again while the flag remains enabled', () => {
        vi.stubEnv('VITE_FORCE_ONBOARDING', 'true')
        saveOnboardingCompletion('completed')
        useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
        useLedgersMock.mockReturnValue({
          ledgers: [ledger],
          activeLedger: ledger,
          loading: false,
          error: null,
          switchLedger: vi.fn(),
        })

        const first = render(<App />)
        skipOrientation()
        expect(first.getByText('Worked out')).toBeInTheDocument()
        first.unmount()

        const second = render(<App />)
        expect(second.getByText(/not a habit tracker/i)).toBeInTheDocument()
        expect(second.queryByText('Worked out')).not.toBeInTheDocument()
      })

      it('leaves normal already-authenticated behavior unchanged when the flag is disabled -- straight to Home, no orientation', () => {
        saveOnboardingCompletion('completed')
        useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
        useLedgersMock.mockReturnValue({
          ledgers: [ledger],
          activeLedger: ledger,
          loading: false,
          error: null,
          switchLedger: vi.fn(),
        })

        render(<App />)

        expect(screen.queryByText(/not a habit tracker/i)).not.toBeInTheDocument()
        expect(screen.getByText('Worked out')).toBeInTheDocument()
      })
    })
  })

  it('automatically opens the real in-app ledger-creation sheet when authenticated with no ledger yet -- no standalone setup page', () => {
    useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: false, error: null, switchLedger: vi.fn() })

    render(<App />)

    // The real Home shell is present underneath (brand still shows),
    // not swapped out for a different screen.
    expect(screen.getByText('Marked.')).toBeInTheDocument()
    expect(screen.getByText(/what are you tracking/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ledgers' })).toBeInTheDocument()
  })

  it("a brand-new account's first ledger, created through the auto-opened sheet, never uses the legacy default id -- it enters the new per-ledger schema", async () => {
    useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    useLedgersMock.mockReturnValue({ ledgers: [], activeLedger: null, loading: false, error: null, switchLedger: vi.fn() })

    render(<App />)

    fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
    fireEvent.change(screen.getByLabelText('Default state'), { target: { value: 'No' } })
    fireEvent.change(screen.getByLabelText('Marked state'), { target: { value: 'Yes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const expectedTimezone = resolveDeviceTimezone()
    const expectedStartDate = getTodayKey(expectedTimezone)

    await vi.waitFor(() => {
      expect(createLedgerMock).toHaveBeenCalledWith('u1', {
        name: 'Reading',
        defaultState: 'didnt',
        stateLabels: { didnt: 'No', did: 'Yes' },
        timezone: expectedTimezone,
        startDate: expectedStartDate,
        color: 'espresso',
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
