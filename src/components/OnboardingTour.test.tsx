import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const { useInstallPromptMock, isIOSDeviceMock, isStandaloneDisplayMock } = vi.hoisted(() => ({
  useInstallPromptMock: vi.fn(),
  isIOSDeviceMock: vi.fn(),
  isStandaloneDisplayMock: vi.fn(),
}))

vi.mock('../hooks/useInstallPrompt', () => ({ useInstallPrompt: useInstallPromptMock }))
vi.mock('../lib/platform', () => ({
  isIOSDevice: isIOSDeviceMock,
  isStandaloneDisplay: isStandaloneDisplayMock,
}))

const { OnboardingTour } = await import('./OnboardingTour')

function mockPlatform({
  ios = false,
  standalone = false,
  canPromptInstall = false,
  promptInstall = vi.fn().mockResolvedValue('accepted'),
} = {}) {
  isIOSDeviceMock.mockReturnValue(ios)
  isStandaloneDisplayMock.mockReturnValue(standalone)
  useInstallPromptMock.mockReturnValue({ canPromptInstall, promptInstall })
  return { promptInstall }
}

function renderTour(onFinish = vi.fn()) {
  render(
    <>
      <div data-tour-id="today-toggle" />
      <div data-tour-id="open-calendar" />
      <OnboardingTour onFinish={onFinish} />
    </>,
  )
  return { onFinish }
}

function clickNext() {
  fireEvent.click(screen.getByRole('button', { name: /^(Next|Done)$/ }))
}

describe('OnboardingTour', () => {
  it('opens on the welcome step with Skip visible and no Back control', () => {
    mockPlatform()
    renderTour()

    expect(screen.getByText(/simple ledger for anything you want to notice/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('Skip exits immediately from the first screen without advancing', () => {
    mockPlatform()
    const { onFinish } = renderTour()

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(onFinish).toHaveBeenCalledWith('skipped')
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('Escape exits the tour as skipped from any step', () => {
    mockPlatform()
    const { onFinish } = renderTour()

    clickNext() // welcome -> concept
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onFinish).toHaveBeenCalledWith('skipped')
  })

  it('moves forward through the intro and back again', () => {
    mockPlatform()
    renderTour()

    clickNext() // welcome -> concept
    expect(screen.getByText(/how it works/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText(/simple ledger for anything you want to notice/i)).toBeInTheDocument()
  })

  it('walks through both coach marks anchored to the real controls, in order', () => {
    mockPlatform()
    renderTour()

    clickNext() // welcome -> concept
    clickNext() // concept -> coach-today
    expect(screen.getByText(/tap or slide to change today's mark/i)).toBeInTheDocument()

    clickNext() // coach-today -> coach-calendar
    expect(screen.getByText(/open the calendar to see, or correct/i)).toBeInTheDocument()
  })

  it('clusters Skip next to the dots only during the calendar coach mark, clear of the spotlighted calendar button in that same corner', () => {
    mockPlatform()
    renderTour()

    clickNext() // welcome -> concept
    clickNext() // concept -> coach-today
    expect(document.querySelector('.onboarding-topbar')).not.toHaveClass('onboarding-topbar-tight')
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()

    clickNext() // coach-today -> coach-calendar
    expect(document.querySelector('.onboarding-topbar')).toHaveClass('onboarding-topbar-tight')
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  })

  it('degrades to a centered callout with no spotlight when the target is not mounted', () => {
    mockPlatform()
    render(<OnboardingTour onFinish={vi.fn()} />) // no stub data-tour-id elements this time

    clickNext() // welcome -> concept
    clickNext() // concept -> coach-today

    expect(screen.getByText(/tap or slide to change today's mark/i)).toBeInTheDocument()
    expect(document.querySelector('.tour-spotlight')).not.toBeInTheDocument()
  })

  it('finishes as completed from the final coach mark when no install step applies', () => {
    mockPlatform({ ios: false, standalone: false, canPromptInstall: false })
    const { onFinish } = renderTour()

    clickNext() // welcome -> concept
    clickNext() // concept -> coach-today
    clickNext() // coach-today -> coach-calendar

    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(onFinish).toHaveBeenCalledWith('completed')
  })

  it('omits the install step when already running standalone, even on an iOS device', () => {
    mockPlatform({ ios: true, standalone: true, canPromptInstall: false })
    renderTour()

    clickNext() // welcome -> concept
    clickNext() // concept -> coach-today
    clickNext() // coach-today -> coach-calendar

    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  })

  it('shows written Share-sheet guidance on iOS, where no native prompt ever exists', () => {
    mockPlatform({ ios: true, standalone: false, canPromptInstall: false })
    renderTour()

    clickNext() // welcome -> concept
    clickNext() // concept -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> install

    expect(screen.getByRole('dialog')).toHaveTextContent(/Share, then/)
    // "Got it" rather than "Done": Noted. has no way to confirm the user
    // actually completed Safari's Add to Home Screen steps, so the CTA only
    // acknowledges the instructions instead of implying a verified install.
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add to Home Screen' })).not.toBeInTheDocument()
  })

  it('offers the native install prompt when the browser has made one available', async () => {
    const { promptInstall } = mockPlatform({ ios: false, standalone: false, canPromptInstall: true })
    const { onFinish } = renderTour()

    clickNext() // welcome -> concept
    clickNext() // concept -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> install

    fireEvent.click(screen.getByRole('button', { name: 'Add to Home Screen' }))

    await vi.waitFor(() => {
      expect(promptInstall).toHaveBeenCalled()
      expect(onFinish).toHaveBeenCalledWith('completed')
    })
  })

  it('lets the install step be declined without installing, still finishing as completed', () => {
    mockPlatform({ ios: false, standalone: false, canPromptInstall: true })
    const { onFinish } = renderTour()

    clickNext() // welcome -> concept
    clickNext() // concept -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> install

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(onFinish).toHaveBeenCalledWith('completed')
  })

  it('does not show a Skip control on the install step, which already has its own two exits', () => {
    mockPlatform({ ios: true, standalone: false })
    renderTour()

    clickNext() // welcome -> concept
    clickNext() // concept -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> install

    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  })
})
