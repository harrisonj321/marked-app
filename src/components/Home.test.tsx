import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const toggle = vi.fn()

vi.mock('../hooks/useTodayState', () => ({
  useTodayState: () => ({
    dateKey: '2026-08-10',
    effectiveState: 'did' as const,
    pending: false,
    error: null,
    toggle,
  }),
}))
vi.mock('../data/tracker', () => ({ updateTrackerName: vi.fn() }))
vi.mock('../lib/auth', () => ({ signOutUser: vi.fn() }))

const { Home } = await import('./Home')

const tracker = {
  name: 'Worked out',
  defaultState: 'did' as const,
  timezone: 'UTC',
  startDate: '2026-08-10',
}

describe('Home', () => {
  it("shows the tracker name and today's effective state", () => {
    render(<Home uid="u1" tracker={tracker} />)

    expect(screen.getByText('Worked out')).toBeInTheDocument()
    expect(screen.getByText('Did')).toBeInTheDocument()
  })

  it('the primary control names the action it will take and calls toggle', () => {
    render(<Home uid="u1" tracker={tracker} />)

    const button = screen.getByRole('button', { name: /mark today as "didn't"/i })
    fireEvent.click(button)

    expect(toggle).toHaveBeenCalled()
  })
})
