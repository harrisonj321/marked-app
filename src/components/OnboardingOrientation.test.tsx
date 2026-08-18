import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const { OnboardingOrientation } = await import('./OnboardingOrientation')

describe('OnboardingOrientation', () => {
  it('renders the full tour -- welcome screen included -- over a neutral demo shell, not a second design', () => {
    render(<OnboardingOrientation onFinish={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Noted.' })).toBeInTheDocument()
    expect(screen.getByText(/not a habit tracker/i)).toBeInTheDocument()
  })

  it('exposes the same four coach-mark anchors the tour targets, with neutral placeholder content -- no fabricated personal data', () => {
    const { container } = render(<OnboardingOrientation onFinish={vi.fn()} />)

    expect(container.querySelector('[data-tour-id="today-toggle"]')).toBeInTheDocument()
    expect(container.querySelector('[data-tour-id="open-calendar"]')).toBeInTheDocument()
    expect(container.querySelector('[data-tour-id="open-settings"]')).toBeInTheDocument()
    expect(container.querySelector('[data-tour-id="ledger-title"]')).toBeInTheDocument()
    expect(screen.getByText('Example')).toBeInTheDocument()
    // Nothing signed-in-only belongs on a pre-auth screen.
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('makes the demo shell inert, so it cannot be interacted with underneath the tour', () => {
    const { container } = render(<OnboardingOrientation onFinish={vi.fn()} />)

    expect(container.querySelector('main')).toHaveAttribute('inert')
  })

  it('uses the real TodayToggle control, not a static picture of one', () => {
    render(<OnboardingOrientation onFinish={vi.fn()} />)

    // jsdom does not enforce `inert`'s interaction-blocking behavior, which
    // is exactly what lets this prove the control is the genuine, wired
    // TodayToggle component (see TodayToggle.test.tsx for its own dedicated
    // interaction coverage) rather than a disabled picture of one.
    const options = screen.getAllByRole('radio')
    expect(options).toHaveLength(2)
    fireEvent.click(options[1])
    expect(options[1]).toBeChecked()
  })

  it('propagates completion from the underlying tour', () => {
    const onFinish = vi.fn()
    render(<OnboardingOrientation onFinish={onFinish} />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(onFinish).toHaveBeenCalledWith('skipped')
  })
})
