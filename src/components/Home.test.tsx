import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./TodaySection', () => ({
  TodaySection: ({ defaultState, timezone }: { defaultState: string; timezone: string }) => (
    <div data-testid="today-section">
      today-section:{defaultState}:{timezone}
    </div>
  ),
}))
vi.mock('./Calendar', () => ({
  Calendar: ({ todayKey }: { todayKey: string }) => (
    <div data-testid="calendar">calendar:{todayKey}</div>
  ),
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
  it('renders the brand, tracker name, today section, and calendar', () => {
    render(<Home uid="u1" tracker={tracker} />)

    expect(screen.getByText('Noted.')).toBeInTheDocument()
    expect(screen.getByText('Worked out')).toBeInTheDocument()
    expect(screen.getByTestId('today-section')).toHaveTextContent('today-section:did:UTC')
    expect(screen.getByTestId('calendar')).toBeInTheDocument()
  })

  it('provides a sign-out control', () => {
    render(<Home uid="u1" tracker={tracker} />)
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })
})
