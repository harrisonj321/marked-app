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

const { OnboardingTour } = await import('./OnboardingTour')

function mockPlatform({
  ios = false,
  standalone = false,
  canPromptInstall = false,
  reducedMotion = false,
  promptInstall = vi.fn().mockResolvedValue('accepted'),
} = {}) {
  isIOSDeviceMock.mockReturnValue(ios)
  isStandaloneDisplayMock.mockReturnValue(standalone)
  prefersReducedMotionMock.mockReturnValue(reducedMotion)
  useInstallPromptMock.mockReturnValue({ canPromptInstall, promptInstall })
  return { promptInstall }
}

function renderTour(onFinish = vi.fn()) {
  render(
    <>
      <div data-tour-id="open-settings" />
      <div data-tour-id="today-toggle" />
      <div data-tour-id="open-calendar" />
      <div data-tour-id="ledger-title" />
      <OnboardingTour onFinish={onFinish} />
    </>,
  )
  return { onFinish }
}

// The intro's primary action is "Noted." (acknowledging is the product's
// whole gesture); coach steps advance with Next and close with Done.
function clickNext() {
  fireEvent.click(screen.getByRole('button', { name: /^(Noted\.|Next|Done)$/ }))
}

/**
 * jsdom has no AnimationEvent constructor, so fireEvent.animationEnd falls
 * back to a plain Event and drops the animationName the component's native
 * listeners key on. Building the event manually keeps that field intact.
 */
function fireAnimationEnd(element: Element, animationName: string) {
  const event = new Event('animationend', { bubbles: true }) as Event & { animationName: string }
  event.animationName = animationName
  fireEvent(element, event)
}

/**
 * jsdom's real getBoundingClientRect is always a zero-rect, which cannot
 * distinguish which data-tour-id element a coach mark actually measured --
 * a step accidentally wired to the wrong tourId would look identical. This
 * gives each stub target a distinct, identifiable rect so a test can assert
 * the rendered spotlight reflects the *specific* real control it claims to.
 */
function mockDistinctTourRects() {
  const rectsByTourId: Record<string, DOMRect> = {
    'open-settings': { top: 700, left: 10, width: 20, height: 20, bottom: 720, right: 30 } as DOMRect,
    'today-toggle': { top: 300, left: 10, width: 20, height: 20, bottom: 320, right: 30 } as DOMRect,
    'open-calendar': { top: 40, left: 10, width: 20, height: 20, bottom: 60, right: 30 } as DOMRect,
    'ledger-title': { top: 200, left: 10, width: 20, height: 20, bottom: 220, right: 30 } as DOMRect,
  }
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    const tourId = this.getAttribute('data-tour-id')
    const rect = (tourId && rectsByTourId[tourId]) || ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 } as DOMRect)
    return { ...rect, x: rect.left, y: rect.top, toJSON: () => {} }
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OnboardingTour', () => {
  it('opens on the intro with the staged wordmark and lines, Skip visible, and no Back control anywhere in the tour', () => {
    mockPlatform()
    renderTour()

    expect(screen.getByRole('heading', { name: 'Noted.' })).toBeInTheDocument()
    expect(screen.getByText(/not a habit tracker/i)).toBeInTheDocument()
    expect(screen.getByText(/not about keeping score/i)).toBeInTheDocument()
    expect(screen.getByText(/just a ledger of whatever/i)).toBeInTheDocument()
    expect(screen.getByText(/just visibility/i)).toBeInTheDocument()
    expect(screen.getByText(/^It's just Noted\.$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it("advances from the intro with a primary action reading Noted., not generic tour language", () => {
    mockPlatform()
    renderTour()

    expect(screen.getByRole('button', { name: 'Noted.' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('keeps the staged primary out of the tab order until its entrance finishes, then focuses it', () => {
    mockPlatform()
    renderTour()

    const primary = screen.getByRole('button', { name: 'Noted.' })
    // While the reveal is still holding the footer invisible, focus rests
    // on the (visible) dialog and the hidden button is not tabbable.
    expect(primary).toHaveAttribute('tabindex', '-1')
    expect(document.querySelector('.onboarding-intro')).toHaveFocus()

    fireAnimationEnd(primary.parentElement!, 'onboarding-rise')

    expect(primary).not.toHaveAttribute('tabindex')
    expect(primary).toHaveFocus()
  })

  it('focuses the primary immediately when reduced motion strips the entrance animations', () => {
    mockPlatform({ reducedMotion: true })
    renderTour()

    const primary = screen.getByRole('button', { name: 'Noted.' })
    expect(primary).not.toHaveAttribute('tabindex')
    expect(primary).toHaveFocus()
  })

  it('moves focus to a coach step primary only after its entrance fade completes', () => {
    mockPlatform()
    renderTour()

    clickNext() // welcome -> coach-today
    const next = screen.getByRole('button', { name: 'Next' })
    expect(next).not.toHaveFocus()

    fireAnimationEnd(document.querySelector('.tour-callout')!, 'onboarding-fade')

    expect(next).toHaveFocus()
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

    clickNext() // welcome -> coach-today
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onFinish).toHaveBeenCalledWith('skipped')
  })

  it('leads from the intro straight to the primary daily control, not another intro slide or a settings detour', () => {
    mockPlatform()
    renderTour()

    clickNext() // welcome -> coach-today
    expect(screen.getByText(/flip today's mark/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Noted.' })).not.toBeInTheDocument()
  })

  it('walks the coach marks in importance order: today, then the record, then wording, then ledgers last', () => {
    mockPlatform()
    renderTour()

    clickNext() // welcome -> coach-today
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText(/flip today's mark/i)).toBeInTheDocument()

    clickNext() // coach-today -> coach-calendar
    expect(screen.getByText('The record')).toBeInTheDocument()
    expect(screen.getByText(/tap a past day to correct it/i)).toBeInTheDocument()

    clickNext() // coach-calendar -> coach-customize
    expect(screen.getByText('Your words')).toBeInTheDocument()
    expect(screen.getByText(/rename the two states/i)).toBeInTheDocument()

    clickNext() // coach-customize -> coach-ledger
    expect(screen.getByText('More to note?')).toBeInTheDocument()
    expect(screen.getByText(/tap the name to switch ledgers or add another/i)).toBeInTheDocument()
  })

  it('keeps one persistent spotlight element across coach steps, so its position transition can glide between controls', () => {
    mockDistinctTourRects()
    mockPlatform()
    renderTour()

    clickNext() // welcome -> coach-today
    const spotlight = document.querySelector('.tour-spotlight')
    expect(spotlight).toHaveStyle({ top: '290px' })

    clickNext() // coach-today -> coach-calendar
    // Same DOM node, new position: a remounted spotlight would jump
    // instead of transitioning.
    expect(document.querySelector('.tour-spotlight')).toBe(spotlight)
    expect(document.querySelector('.tour-spotlight')).toHaveStyle({ top: '50px' })
  })

  it('measures the real open-settings element specifically, not merely any coach-mark target', () => {
    mockDistinctTourRects()
    mockPlatform()
    renderTour()

    clickNext() // welcome -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> coach-customize
    // A tourId mix-up (e.g. wired to 'today-toggle' or 'open-calendar' by
    // mistake) would measure a different stub and produce a different top --
    // this pins the spotlight to the one open-settings owns.
    expect(document.querySelector('.tour-spotlight')).toHaveStyle({ top: '690px' })
  })

  it('measures the real ledger-title element specifically for its own coach mark', () => {
    mockDistinctTourRects()
    mockPlatform()
    renderTour()

    clickNext() // welcome -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> coach-customize
    clickNext() // coach-customize -> coach-ledger
    expect(document.querySelector('.tour-spotlight')).toHaveStyle({ top: '190px' })
  })

  it('still reaches and anchors the ledger coach mark when there is only one ledger', () => {
    // The trigger renders identically regardless of ledger count -- this
    // step's geometry and reachability do not depend on there being
    // anything to switch to yet.
    mockPlatform()
    renderTour()

    clickNext() // welcome -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> coach-customize
    clickNext() // coach-customize -> coach-ledger

    expect(screen.getByText('More to note?')).toBeInTheDocument()
    expect(document.querySelector('.tour-spotlight')).toBeInTheDocument()
  })

  it('shows exactly one progress dot per step, adapting when the install step is present or omitted', () => {
    mockPlatform({ ios: false, standalone: false, canPromptInstall: false })
    renderTour()
    // welcome, coach-today, coach-calendar, coach-customize, coach-ledger -- no install step.
    expect(document.querySelectorAll('.onboarding-dot')).toHaveLength(5)
  })

  it('adds a sixth progress dot when the install step applies', () => {
    mockPlatform({ ios: true, standalone: false, canPromptInstall: false })
    renderTour()
    expect(document.querySelectorAll('.onboarding-dot')).toHaveLength(6)
  })

  it('keeps the top bar in one unchanging layout across every step, so Skip never changes position', () => {
    mockPlatform()
    renderTour()

    const topbarClassName = () => document.querySelector('.onboarding-topbar')?.className

    expect(topbarClassName()).toBe('onboarding-topbar')
    clickNext() // welcome -> coach-today
    expect(topbarClassName()).toBe('onboarding-topbar')
    clickNext() // coach-today -> coach-calendar
    expect(topbarClassName()).toBe('onboarding-topbar')
    clickNext() // coach-calendar -> coach-customize
    expect(topbarClassName()).toBe('onboarding-topbar')
    clickNext() // coach-customize -> coach-ledger
    expect(topbarClassName()).toBe('onboarding-topbar')
  })

  it('insets the calendar spotlight from the top by more than the default coach-mark padding, to clear Skip in its one fixed position', () => {
    mockPlatform()
    renderTour()

    clickNext() // welcome -> coach-today
    // All stub targets report a zero rect in jsdom, so the difference in
    // computed inline style isolates the padding math itself.
    expect(document.querySelector('.tour-spotlight')).toHaveStyle({ top: '-10px' })

    clickNext() // coach-today -> coach-calendar
    expect(document.querySelector('.tour-spotlight')).toHaveStyle({ top: '10px' })

    clickNext() // coach-calendar -> coach-customize
    expect(document.querySelector('.tour-spotlight')).toHaveStyle({ top: '-10px' })
  })

  it('degrades to a centered callout with no spotlight when the target is not mounted', () => {
    mockPlatform()
    render(<OnboardingTour onFinish={vi.fn()} />) // no stub data-tour-id elements this time

    clickNext() // welcome -> coach-today

    expect(screen.getByText(/flip today's mark/i)).toBeInTheDocument()
    expect(document.querySelector('.tour-spotlight')).not.toBeInTheDocument()
  })

  it('attaches the spotlight late if the target mounts partway through its step', async () => {
    mockPlatform()
    render(<OnboardingTour onFinish={vi.fn()} />) // target not mounted yet (e.g. still loading)

    clickNext() // welcome -> coach-today
    expect(document.querySelector('.tour-spotlight')).not.toBeInTheDocument()

    const target = document.createElement('div')
    target.setAttribute('data-tour-id', 'today-toggle')
    await act(async () => {
      document.body.appendChild(target)
      // MutationObserver delivery is asynchronous; yield one macrotask.
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(document.querySelector('.tour-spotlight')).toBeInTheDocument()
    target.remove()
  })

  it('finishes as completed from the final coach mark when no install step applies', () => {
    mockPlatform({ ios: false, standalone: false, canPromptInstall: false })
    const { onFinish } = renderTour()

    clickNext() // welcome -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> coach-customize
    clickNext() // coach-customize -> coach-ledger

    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(onFinish).toHaveBeenCalledWith('completed')
  })

  it('omits the install step when already running standalone, even on an iOS device', () => {
    mockPlatform({ ios: true, standalone: true, canPromptInstall: false })
    renderTour()

    clickNext() // welcome -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> coach-customize
    clickNext() // coach-customize -> coach-ledger

    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  })

  it('shows the real app icon on the install step, so the card previews exactly what lands on the Home Screen', () => {
    mockPlatform({ ios: true, standalone: false, canPromptInstall: false })
    renderTour()

    clickNext() // welcome -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> coach-customize
    clickNext() // coach-customize -> coach-ledger
    clickNext() // coach-ledger -> install

    const icon = document.querySelector('.onboarding-install-icon')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('src', '/icon-192.png')
  })

  it('shows written Share-sheet guidance on iOS, where no native prompt ever exists', () => {
    mockPlatform({ ios: true, standalone: false, canPromptInstall: false })
    renderTour()

    clickNext() // welcome -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> coach-customize
    clickNext() // coach-customize -> coach-ledger
    clickNext() // coach-ledger -> install

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

    clickNext() // welcome -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> coach-customize
    clickNext() // coach-customize -> coach-ledger
    clickNext() // coach-ledger -> install

    fireEvent.click(screen.getByRole('button', { name: 'Add to Home Screen' }))

    await vi.waitFor(() => {
      expect(promptInstall).toHaveBeenCalled()
      expect(onFinish).toHaveBeenCalledWith('completed')
    })
  })

  it('lets the install step be declined without installing, still finishing as completed', () => {
    mockPlatform({ ios: false, standalone: false, canPromptInstall: true })
    const { onFinish } = renderTour()

    clickNext() // welcome -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> coach-customize
    clickNext() // coach-customize -> coach-ledger
    clickNext() // coach-ledger -> install

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(onFinish).toHaveBeenCalledWith('completed')
  })

  it('does not show a Skip control on the install step, which already has its own two exits', () => {
    mockPlatform({ ios: true, standalone: false })
    renderTour()

    clickNext() // welcome -> coach-today
    clickNext() // coach-today -> coach-calendar
    clickNext() // coach-calendar -> coach-customize
    clickNext() // coach-customize -> coach-ledger
    clickNext() // coach-ledger -> install

    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  })

  describe('staged presentation (the pre-auth orientation)', () => {
    function renderStaged({ reducedMotion = false } = {}) {
      mockPlatform({ reducedMotion })
      const onFinish = vi.fn()
      const onStageChange = vi.fn()
      render(
        <>
          <div data-tour-id="open-settings" />
          <div data-tour-id="today-toggle" />
          <div data-tour-id="open-calendar" />
          <div data-tour-id="ledger-title" />
          <OnboardingTour presentation="staged" onStageChange={onStageChange} onFinish={onFinish} />
        </>,
      )
      return { onFinish, onStageChange }
    }

    /** Advances past the welcome screen the way a motion-enabled browser would: press, then let the exit fade report done. */
    function leaveIntro() {
      fireEvent.click(screen.getByRole('button', { name: 'Noted.' }))
      fireAnimationEnd(document.querySelector('.onboarding-intro')!, 'onboarding-intro-leave')
    }

    it('holds the welcome screen while its exit fade plays, then advances when the fade reports done', () => {
      renderStaged()

      fireEvent.click(screen.getByRole('button', { name: 'Noted.' }))

      // Still the intro, now leaving -- no coach copy yet, no hard cut.
      expect(document.querySelector('.onboarding-intro-leaving')).toBeInTheDocument()
      expect(screen.queryByText(/flip today's mark/i)).not.toBeInTheDocument()

      fireAnimationEnd(document.querySelector('.onboarding-intro')!, 'onboarding-intro-leave')

      expect(screen.getByText(/flip today's mark/i)).toBeInTheDocument()
    })

    it('advances from the welcome screen immediately under reduced motion, where the exit fade would never play', () => {
      renderStaged({ reducedMotion: true })

      fireEvent.click(screen.getByRole('button', { name: 'Noted.' }))

      expect(screen.getByText(/flip today's mark/i)).toBeInTheDocument()
    })

    it('anchors each coach step with the spotlight and an adjacent callout -- explicit targeting, not a detached placard', () => {
      renderStaged()
      leaveIntro()

      expect(document.querySelector('.onboarding-coach')).toBeInTheDocument()
      // The staged veil is the softer variant of the same overlay.
      expect(document.querySelector('.onboarding-coach')).toHaveClass('onboarding-coach-staged')
      expect(document.querySelector('.tour-spotlight')).toBeInTheDocument()
      expect(document.querySelector('.tour-callout')).toBeInTheDocument()
      expect(document.querySelector('.onboarding-placard')).not.toBeInTheDocument()
    })

    it('wears the quiet surface treatment on intermediate Nexts and focuses each new callout once its entrance settles', () => {
      renderStaged()
      leaveIntro()

      const primary = screen.getByRole('button', { name: 'Next' })
      // The accent fill is reserved for the sequence's bookends (intro and
      // Done); mid-orientation the interface stays the loudest thing.
      expect(primary).not.toHaveClass('onboarding-primary')

      fireAnimationEnd(document.querySelector('.tour-callout')!, 'onboarding-fade')
      expect(primary).toHaveFocus()

      fireEvent.click(primary)

      expect(screen.getByText(/tap a past day to correct it/i)).toBeInTheDocument()
      const nextPrimary = screen.getByRole('button', { name: 'Next' })
      expect(nextPrimary).not.toHaveClass('onboarding-primary')
      fireAnimationEnd(document.querySelector('.tour-callout')!, 'onboarding-fade')
      expect(nextPrimary).toHaveFocus()
    })

    it('keeps one persistent spotlight element across staged steps, so its position transition can glide between controls', () => {
      mockDistinctTourRects()
      renderStaged()
      leaveIntro()

      const spotlight = document.querySelector('.tour-spotlight')
      expect(spotlight).toHaveStyle({ top: '290px' })

      fireEvent.click(screen.getByRole('button', { name: 'Next' }))

      expect(document.querySelector('.tour-spotlight')).toBe(spotlight)
      expect(document.querySelector('.tour-spotlight')).toHaveStyle({ top: '50px' })
    })

    it('reports each scene to the host shell as the steps advance', () => {
      const { onStageChange } = renderStaged({ reducedMotion: true })

      clickNext() // welcome -> coach-today
      clickNext() // coach-today -> coach-calendar
      clickNext() // coach-calendar -> coach-customize
      clickNext() // coach-customize -> coach-ledger

      expect(onStageChange.mock.calls.map(([stage]) => stage)).toEqual([
        'welcome',
        'today',
        'calendar',
        'settings',
        'ledger',
      ])
    })

    it('plays a closing beat on Done -- reporting the closing scene -- and finishes only when it reports done', () => {
      const { onFinish, onStageChange } = renderStaged()
      leaveIntro()
      clickNext() // coach-today -> coach-calendar
      clickNext() // coach-calendar -> coach-customize
      clickNext() // coach-customize -> coach-ledger

      // The final action regains the accent-filled emphasis the
      // intermediate Nexts deliberately gave up.
      expect(screen.getByRole('button', { name: 'Done' })).toHaveClass('onboarding-primary')

      fireEvent.click(screen.getByRole('button', { name: 'Done' }))

      expect(onFinish).not.toHaveBeenCalled()
      expect(onStageChange).toHaveBeenLastCalledWith('closing')
      expect(document.querySelector('.onboarding-coach')).toHaveClass('onboarding-closing')

      fireAnimationEnd(document.querySelector('.onboarding-coach')!, 'onboarding-close')

      expect(onFinish).toHaveBeenCalledWith('completed')
      expect(onFinish).toHaveBeenCalledTimes(1)
    })

    it('finishes immediately from Done under reduced motion, with no closing beat', () => {
      const { onFinish, onStageChange } = renderStaged({ reducedMotion: true })

      clickNext() // welcome -> coach-today
      clickNext() // coach-today -> coach-calendar
      clickNext() // coach-calendar -> coach-customize
      clickNext() // coach-customize -> coach-ledger
      clickNext() // Done

      expect(onFinish).toHaveBeenCalledWith('completed')
      expect(onStageChange).not.toHaveBeenCalledWith('closing')
    })

    it('retires Skip and ignores Escape during the closing beat -- the finish is already committed', () => {
      const { onFinish } = renderStaged()
      leaveIntro()
      clickNext() // coach-today -> coach-calendar
      clickNext() // coach-calendar -> coach-customize
      clickNext() // coach-customize -> coach-ledger
      fireEvent.click(screen.getByRole('button', { name: 'Done' }))

      expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onFinish).not.toHaveBeenCalled()

      fireAnimationEnd(document.querySelector('.onboarding-coach')!, 'onboarding-close')
      expect(onFinish).toHaveBeenCalledWith('completed')
      expect(onFinish).toHaveBeenCalledTimes(1)
    })
  })
})
