import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

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
    onDismiss,
  }: {
    defaultState: string
    onSaveDefaultState: (next: 'did' | 'didnt') => Promise<void>
    onDismiss: () => void
  }) => (
    <div data-testid="settings-sheet">
      settings-sheet:{defaultState}
      <button type="button" onClick={() => void onSaveDefaultState('didnt').catch(reportSaveError)}>
        Save didnt
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

beforeEach(() => {
  reportSaveError.mockReset()
  updateTrackerNameMock.mockReset().mockResolvedValue(undefined)
  updateTrackerDefaultStateMock.mockReset().mockResolvedValue(undefined)
})

const { Home } = await import('./Home')

const tracker = {
  name: 'Worked out',
  defaultState: 'did' as const,
  timezone: 'UTC',
  startDate: '2026-08-01',
}

describe('Home', () => {
  it('renders the brand, date, tracker name, and today section without the calendar', () => {
    render(<Home uid="u1" tracker={tracker} />)

    expect(screen.getByText('Noted.')).toBeInTheDocument()
    expect(screen.getByText('Today · 08/10/2026')).toBeInTheDocument()
    expect(screen.getByText('Worked out')).toBeInTheDocument()
    expect(screen.getByTestId('today-section')).toHaveTextContent('today-section:did:UTC')
    expect(screen.queryByTestId('calendar-sheet')).not.toBeInTheDocument()
  })

  it('opens and closes the calendar from the header control', () => {
    render(<Home uid="u1" tracker={tracker} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open calendar' }))
    expect(screen.getByTestId('calendar-sheet')).toHaveTextContent('calendar-sheet:2026-08-10')

    fireEvent.click(screen.getByRole('button', { name: 'Close calendar' }))
    expect(screen.queryByTestId('calendar-sheet')).not.toBeInTheDocument()
  })

  it('opens and closes settings from the footer link', () => {
    render(<Home uid="u1" tracker={tracker} />)
    expect(screen.queryByTestId('settings-sheet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByTestId('settings-sheet')).toHaveTextContent('settings-sheet:did')

    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(screen.queryByTestId('settings-sheet')).not.toBeInTheDocument()
  })

  it('saves a new default state with the current one, so existing days can be pinned first', async () => {
    render(<Home uid="u1" tracker={tracker} />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save didnt' }))

    await vi.waitFor(() => {
      expect(updateTrackerDefaultStateMock).toHaveBeenCalledWith('u1', 'did', 'didnt')
    })
  })

  it('propagates a failed default-state save so the sheet can report it', async () => {
    updateTrackerDefaultStateMock.mockRejectedValue(new Error('offline'))
    render(<Home uid="u1" tracker={tracker} />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save didnt' }))

    await vi.waitFor(() => {
      expect(reportSaveError).toHaveBeenCalled()
    })
  })

  it('provides a sign-out control', () => {
    render(<Home uid="u1" tracker={tracker} />)
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('shows the maker mark with the app version', () => {
    render(<Home uid="u1" tracker={tracker} />)
    expect(screen.getByText(`Made with ❤️ by Maker 428 · v${__APP_VERSION__}`)).toBeInTheDocument()
  })
})
