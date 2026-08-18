import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

const { useInstallPromptMock, isIOSDeviceMock, isStandaloneDisplayMock, prefersReducedMotionMock } =
  vi.hoisted(() => ({
    useInstallPromptMock: vi.fn(),
    isIOSDeviceMock: vi.fn(),
    isStandaloneDisplayMock: vi.fn(),
    prefersReducedMotionMock: vi.fn(),
  }))

vi.mock('../hooks/useInstallPrompt', () => ({ useInstallPrompt: useInstallPromptMock }))
vi.mock('../lib/platform', () => ({
  isIOSDevice: isIOSDeviceMock,
  isStandaloneDisplay: isStandaloneDisplayMock,
  prefersReducedMotion: prefersReducedMotionMock,
}))

const { OnboardingOrientation } = await import('./OnboardingOrientation')

function mockPlatform({ reducedMotion = false } = {}) {
  isIOSDeviceMock.mockReturnValue(false)
  isStandaloneDisplayMock.mockReturnValue(false)
  prefersReducedMotionMock.mockReturnValue(reducedMotion)
  useInstallPromptMock.mockReturnValue({ canPromptInstall: false, promptInstall: vi.fn() })
}

/** See OnboardingTour.test.tsx: jsdom's fireEvent.animationEnd drops animationName, which the exit-beat listeners key on. */
function fireAnimationEnd(element: Element, animationName: string) {
  const event = new Event('animationend', { bubbles: true }) as Event & { animationName: string }
  event.animationName = animationName
  fireEvent(element, event)
}

/** Advances past the welcome screen the way a motion-enabled browser would: press, then let the exit fade report done. */
function leaveIntro() {
  fireEvent.click(screen.getByRole('button', { name: 'Noted.' }))
  fireAnimationEnd(document.querySelector('.onboarding-intro')!, 'onboarding-intro-leave')
}

function shellStage(container: HTMLElement): string | null {
  return container.querySelector('main')?.getAttribute('data-stage') ?? null
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('OnboardingOrientation', () => {
  it('renders the full tour -- welcome screen included -- over a neutral demo shell, not a second design', () => {
    mockPlatform()
    render(<OnboardingOrientation onFinish={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Noted.' })).toBeInTheDocument()
    expect(screen.getByText(/not a habit tracker/i)).toBeInTheDocument()
  })

  it('stages all four taught concepts on the shell, with neutral placeholder content -- no fabricated personal data', () => {
    mockPlatform()
    const { container } = render(<OnboardingOrientation onFinish={vi.fn()} />)

    expect(container.querySelector('[data-demo="toggle"]')).toBeInTheDocument()
    expect(container.querySelector('[data-demo="calendar"]')).toBeInTheDocument()
    expect(container.querySelector('[data-demo="settings"]')).toBeInTheDocument()
    expect(container.querySelector('[data-demo="title"]')).toBeInTheDocument()
    // The switch affordance exists from the start; its scene is what reveals it.
    expect(container.querySelector('[data-demo="chevron"]')).toBeInTheDocument()
    // The demo ledger's name is the intro's own line made concrete, not a
    // developer placeholder.
    expect(screen.getByText('Whatever.')).toBeInTheDocument()
    // Nothing signed-in-only belongs on a pre-auth screen, and the real
    // Home's maker mark stays out of the orientation entirely.
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Maker 428/)).not.toBeInTheDocument()
  })

  it('makes the demo shell inert, so it cannot be interacted with underneath the tour', () => {
    mockPlatform()
    const { container } = render(<OnboardingOrientation onFinish={vi.fn()} />)

    expect(container.querySelector('main')).toHaveAttribute('inert')
  })

  it('uses the real TodayToggle control, not a static picture of one', () => {
    mockPlatform()
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

  it('holds the shell unstaged behind the welcome screen, then walks it scene by scene as the tour advances', () => {
    mockPlatform({ reducedMotion: true })
    const { container } = render(<OnboardingOrientation onFinish={vi.fn()} />)

    expect(shellStage(container)).toBe('welcome')

    fireEvent.click(screen.getByRole('button', { name: 'Noted.' }))
    expect(shellStage(container)).toBe('today')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(shellStage(container)).toBe('calendar')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(shellStage(container)).toBe('settings')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(shellStage(container)).toBe('ledger')
  })

  it("demonstrates the toggle's gesture once during the today scene -- the mark slides over, rests, and returns", () => {
    vi.useFakeTimers()
    mockPlatform()
    render(<OnboardingOrientation onFinish={vi.fn()} />)
    leaveIntro()

    const [didnt, did] = screen.getAllByRole('radio')
    expect(didnt).toBeChecked()

    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(did).toBeChecked()

    act(() => {
      vi.advanceTimersByTime(1400)
    })
    expect(didnt).toBeChecked()
  })

  it('cancels the demonstration and restores the mark the moment the scene moves on', () => {
    vi.useFakeTimers()
    mockPlatform()
    render(<OnboardingOrientation onFinish={vi.fn()} />)
    leaveIntro()

    act(() => {
      vi.advanceTimersByTime(1600)
    })
    const [didnt, did] = screen.getAllByRole('radio')
    expect(did).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Next' })) // today -> calendar
    expect(didnt).toBeChecked()

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(didnt).toBeChecked()
  })

  it('skips the demonstration entirely under reduced motion', () => {
    vi.useFakeTimers()
    mockPlatform({ reducedMotion: true })
    render(<OnboardingOrientation onFinish={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Noted.' }))
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    const [didnt] = screen.getAllByRole('radio')
    expect(didnt).toBeChecked()
  })

  it('propagates completion from the underlying tour', () => {
    mockPlatform()
    const onFinish = vi.fn()
    render(<OnboardingOrientation onFinish={onFinish} />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(onFinish).toHaveBeenCalledWith('skipped')
  })

  it('stages the closing scene on Done and finishes once the closing beat reports done', () => {
    mockPlatform()
    const onFinish = vi.fn()
    const { container } = render(<OnboardingOrientation onFinish={onFinish} />)
    leaveIntro()
    fireEvent.click(screen.getByRole('button', { name: 'Next' })) // today -> calendar
    fireEvent.click(screen.getByRole('button', { name: 'Next' })) // calendar -> settings
    fireEvent.click(screen.getByRole('button', { name: 'Next' })) // settings -> ledger

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(shellStage(container)).toBe('closing')
    expect(onFinish).not.toHaveBeenCalled()

    fireAnimationEnd(document.querySelector('.onboarding-placard')!, 'onboarding-close')

    expect(onFinish).toHaveBeenCalledWith('completed')
  })
})
