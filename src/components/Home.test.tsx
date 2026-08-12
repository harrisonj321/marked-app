import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { hasCompletedOnboarding, loadOnboardingRecord, saveOnboardingRecord } from '../data/onboarding'

const { reportSaveError, updateTrackerDefaultStateMock, updateTrackerNameMock } = vi.hoisted(
  () => ({
    reportSaveError: vi.fn(),
    updateTrackerDefaultStateMock: vi.fn(),
    updateTrackerNameMock: vi.fn(),
  }),
)

vi.mock('./TodaySection', () => ({
  TodaySection: ({ defaultState, timezone }: { defaultState: string; timezone: string }) => (
    <div data-testid="today-section">
      today-section:{defaultState}:{timezone}
    </div>
  ),
}))
vi.mock('./CalendarSheet', () => ({
  CalendarSheet: ({ todayKey, onDismiss }: { todayKey: string; onDismiss: () => void }) => (
    <div data-testid="calendar-sheet">
      calendar-sheet:{todayKey}
      <button type="button" onClick={onDismiss}>
        Close calendar
      </button>
    </div>
  ),
}))
vi.mock('./SettingsSheet', () => ({
  SettingsSheet: ({
    defaultState,
    onSaveDefaultState,
    onTourNoted,
    onDismiss,
  }: {
    defaultState: string
    onSaveDefaultState: (next: 'did' | 'didnt') => Promise<void>
    onTourNoted: () => void
    onDismiss: () => void
  }) => (
    <div data-testid="settings-sheet">
      settings-sheet:{defaultState}
      <button type="button" onClick={() => void onSaveDefaultState('didnt').catch(reportSaveError)}>
        Save didnt
      </button>
      <button type="button" onClick={onTourNoted}>
        Tour Noted.
      </button>
      <button type="button" onClick={onDismiss}>
        Close settings
      </button>
    </div>
  ),
}))
vi.mock('../hooks/useLocalDateKey', () => ({
  useLocalDateKey: () => '2026-08-10',
}))
vi.mock('../data/tracker', () => ({
  updateTrackerName: updateTrackerNameMock,
  updateTrackerDefaultState: updateTrackerDefaultStateMock,
}))
vi.mock('../lib/auth', () => ({ signOutUser: vi.fn() }))

const WELCOME_TEXT = /simple ledger for anything you want to notice/i

beforeEach(() => {
  reportSaveError.mockReset()
  updateTrackerNameMock.mockReset().mockResolvedValue(undefined)
  updateTrackerDefaultStateMock.mockReset().mockResolvedValue(undefined)
  window.localStorage.clear()
})

const { Home } = await import('./Home')

const tracker = {
  name: 'Worked out',
  defaultState: 'did' as const,
  timezone: 'UTC',
  startDate: '2026-08-01',
}

/**
 * Every test outside the "onboarding tour" block is exercising ordinary
 * Home behavior that has nothing to do with onboarding, so it renders as an
 * account that has already completed the current tour version -- the
 * steady state -- rather than incidentally colliding with the auto-shown
 * tour on a bare uid with no record.
 */
function renderSettledHome(uid = 'u1') {
  saveOnboardingRecord(uid, 'completed')
  return render(<Home uid={uid} tracker={tracker} />)
}

describe('Home', () => {
  it('renders the brand, date, tracker name, and today section without the calendar', () => {
    renderSettledHome()

    expect(screen.getByText('Noted.')).toBeInTheDocument()
    expect(screen.getByText('Today · 08/10/2026')).toBeInTheDocument()
    expect(screen.getByText('Worked out')).toBeInTheDocument()
    expect(screen.getByTestId('today-section')).toHaveTextContent('today-section:did:UTC')
    expect(screen.queryByTestId('calendar-sheet')).not.toBeInTheDocument()
  })

  it('opens and closes the calendar from the header control', () => {
    renderSettledHome()

    fireEvent.click(screen.getByRole('button', { name: 'Open calendar' }))
    expect(screen.getByTestId('calendar-sheet')).toHaveTextContent('calendar-sheet:2026-08-10')

    fireEvent.click(screen.getByRole('button', { name: 'Close calendar' }))
    expect(screen.queryByTestId('calendar-sheet')).not.toBeInTheDocument()
  })

  it('opens and closes settings from the footer link', () => {
    renderSettledHome()
    expect(screen.queryByTestId('settings-sheet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByTestId('settings-sheet')).toHaveTextContent('settings-sheet:did')

    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(screen.queryByTestId('settings-sheet')).not.toBeInTheDocument()
  })

  it('saves a new default state with the current one, so existing days can be pinned first', async () => {
    renderSettledHome()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save didnt' }))

    await vi.waitFor(() => {
      expect(updateTrackerDefaultStateMock).toHaveBeenCalledWith('u1', 'did', 'didnt')
    })
  })

  it('propagates a failed default-state save so the sheet can report it', async () => {
    updateTrackerDefaultStateMock.mockRejectedValue(new Error('offline'))
    renderSettledHome()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save didnt' }))

    await vi.waitFor(() => {
      expect(reportSaveError).toHaveBeenCalled()
    })
  })

  it('provides a sign-out control', () => {
    renderSettledHome()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('shows the maker mark with the app version', () => {
    renderSettledHome()
    expect(screen.getByText(`Made with ❤️ by Maker 428 · v${__APP_VERSION__}`)).toBeInTheDocument()
  })

  describe('onboarding tour', () => {
    it('auto-starts for an established authenticated user with no current-version onboarding record', () => {
      // No isNewUser concept at all: an account with history (tracker
      // already exists, as it always does by the time Home renders) still
      // gets the tour on its next normal open if nothing is recorded yet.
      render(<Home uid="u1" tracker={tracker} />)
      expect(screen.getByText(WELCOME_TEXT)).toBeInTheDocument()
    })

    it('does not auto-start when a completed record exists for this uid', () => {
      saveOnboardingRecord('u1', 'completed')
      render(<Home uid="u1" tracker={tracker} />)
      expect(screen.queryByText(WELCOME_TEXT)).not.toBeInTheDocument()
    })

    it('does not auto-start when a skipped record exists for this uid', () => {
      saveOnboardingRecord('u1', 'skipped')
      render(<Home uid="u1" tracker={tracker} />)
      expect(screen.queryByText(WELCOME_TEXT)).not.toBeInTheDocument()
    })

    it('auto-starts independently per uid, so one account having a record does not suppress another', () => {
      saveOnboardingRecord('u1', 'completed')
      render(<Home uid="u2" tracker={tracker} />)
      expect(screen.getByText(WELCOME_TEXT)).toBeInTheDocument()
    })

    it('makes the main content inert while the tour is active, so it cannot be interacted with underneath', () => {
      const { container } = render(<Home uid="u1" tracker={tracker} />)
      expect(container.querySelector('main')).toHaveAttribute('inert')
    })

    it('is reachable from Settings regardless of completion state, closing the settings sheet when it opens', () => {
      saveOnboardingRecord('u1', 'completed')
      render(<Home uid="u1" tracker={tracker} />)
      expect(screen.queryByText(WELCOME_TEXT)).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      fireEvent.click(screen.getByRole('button', { name: 'Tour Noted.' }))

      expect(screen.queryByTestId('settings-sheet')).not.toBeInTheDocument()
      expect(screen.getByText(WELCOME_TEXT)).toBeInTheDocument()
    })

    it('does not touch the persisted record merely by opening the replay from Settings', () => {
      saveOnboardingRecord('u1', 'completed')
      render(<Home uid="u1" tracker={tracker} />)

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      fireEvent.click(screen.getByRole('button', { name: 'Tour Noted.' }))

      expect(loadOnboardingRecord('u1')).toEqual({ version: 1, status: 'completed' })
    })

    it('persists Skip and does not leave the main content inert afterward', () => {
      const { container } = render(<Home uid="u1" tracker={tracker} />)

      fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

      expect(screen.queryByText(WELCOME_TEXT)).not.toBeInTheDocument()
      expect(container.querySelector('main')).not.toHaveAttribute('inert')
      expect(hasCompletedOnboarding('u1')).toBe(true)
    })
  })
})
