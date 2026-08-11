import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

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
vi.mock('../hooks/useLocalDateKey', () => ({
  useLocalDateKey: () => '2026-08-10',
}))
vi.mock('../data/tracker', () => ({ updateTrackerName: vi.fn() }))
vi.mock('../lib/auth', () => ({ signOutUser: vi.fn() }))

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

  it('provides a sign-out control', () => {
    render(<Home uid="u1" tracker={tracker} />)
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('shows the maker mark with the app version', () => {
    render(<Home uid="u1" tracker={tracker} />)
    expect(screen.getByText(`Made with ❤️ by Maker 428 · v${__APP_VERSION__}`)).toBeInTheDocument()
  })
})
