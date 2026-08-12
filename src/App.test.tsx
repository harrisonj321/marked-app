import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const { useAuthUserMock, useTrackerMock } = vi.hoisted(() => ({
  useAuthUserMock: vi.fn(),
  useTrackerMock: vi.fn(),
}))

vi.mock('./hooks/useAuthUser', () => ({ useAuthUser: useAuthUserMock }))
vi.mock('./hooks/useTracker', () => ({ useTracker: useTrackerMock }))
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
vi.mock('./data/tracker', () => ({
  createTracker: vi.fn(),
  updateTrackerName: vi.fn(),
  updateTrackerDefaultState: vi.fn(),
}))
vi.mock('./data/day', () => ({
  saveDailyRecord: vi.fn(),
}))
vi.mock('./lib/auth', () => ({
  signInWithGoogle: vi.fn(),
  signOutUser: vi.fn(),
}))

const { default: App } = await import('./App')

beforeEach(() => {
  window.localStorage.clear()
})

describe('App', () => {
  it('shows a neutral loading screen while auth resolves', () => {
    useAuthUserMock.mockReturnValue({ user: null, loading: true })
    useTrackerMock.mockReturnValue({ tracker: null, loading: true, error: null })

    render(<App />)

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('shows sign-in when unauthenticated', () => {
    useAuthUserMock.mockReturnValue({ user: null, loading: false })
    useTrackerMock.mockReturnValue({ tracker: null, loading: true, error: null })

    render(<App />)

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('shows setup when authenticated with no tracker yet', () => {
    useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    useTrackerMock.mockReturnValue({ tracker: null, loading: false, error: null })

    render(<App />)

    expect(screen.getByText(/what are you tracking/i)).toBeInTheDocument()
  })

  it('shows a neutral error state if the tracker fails to load', () => {
    useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    useTrackerMock.mockReturnValue({
      tracker: null,
      loading: false,
      error: 'Could not load your tracker. Try again.',
    })

    render(<App />)

    expect(screen.getByRole('alert')).toHaveTextContent(/could not load your tracker/i)
  })

  it('shows the home screen when authenticated with a tracker', () => {
    useAuthUserMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    useTrackerMock.mockReturnValue({
      tracker: {
        name: 'Worked out',
        defaultState: 'did',
        timezone: 'UTC',
        startDate: '2026-08-10',
      },
      loading: false,
      error: null,
    })

    render(<App />)

    expect(screen.getByText('Worked out')).toBeInTheDocument()
  })
})
