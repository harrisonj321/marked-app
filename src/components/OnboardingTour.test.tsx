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

// The intro's primary action is "Marked." (acknowledging is the product's
// whole gesture); coach steps advance with Next and close with Done.
function clickNext() {
  fireEvent.click(screen.getByRole('button', { name: /^(Marked\.|Next|Done)$/ }))
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

/**
 * Presses a key the way a browser does -- on whatever element actually holds
 * focus, bubbling so it can reach the useOverlay boundary on
 * document.documentElement. `fireEvent.keyDown(window, …)` does NOT bubble
 * into `document`/`documentElement` at all (window has no DOM parent to
 * traverse through), so it would silently never reach that listener --
 * exercising nothing rather than the real Escape path.
 */
function pressEscape() {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape', bubbles: true })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OnboardingTour', () => {
  it('opens on the intro with the staged wordmark and lines, Skip visible, and no Back control anywhere in the tour', () => {
    mockPlatform()
    renderTour()

    expect(screen.getByRole('heading', { name: 'Marked.' })).toBeInTheDocument()
    expect(screen.getByText(/not a habit tracker/i)).toBeInTheDocument()
    expect(screen.getByText(/not about keeping score/i)).toBeInTheDocument()
    expect(screen.getByText(/just a ledger of whatever/i)).toBeInTheDocument()
    expect(screen.getByText(/just visibility/i)).toBeInTheDocument()
    expect(screen.getByText(/^It's just Marked\.$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it("advances from the intro with a primary action reading Marked., not generic tour language", () => {
    mockPlatform()
    renderTour()

    expect(screen.getByRole('button', { name: 'Marked.' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('keeps the staged primary out of the tab order until its entrance finishes, then focuses it', () => {
    mockPlatform()
    renderTour()

    const primary = screen.getByRole('button', { name: 'Marked.' })
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

    const primary = screen.getByRole('button', { name: 'Marked.' })
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
    pressEscape()

    expect(onFinish).toHaveBeenCalledWith('skipped')
  })

  it('traps Tab within the tour, wrapping from the last focusable back to the first', () => {
    // useOverlay's own gap-close: previously nothing stopped Tab from
    // leaving the tour into the inert screen underneath (MAKER428.md's
    // named accessibility gap).
    mockPlatform({ reducedMotion: true })
    renderTour()

    clickNext() // welcome -> coach-today; entrance settles immediately under reduced motion
    // DOM/tab order is the coach card's Next, then the topbar's Skip -- Next
    // is first, Skip is last.
    const next = screen.getByRole('button', { name: 'Next' })
    const skip = screen.getByRole('button', { name: 'Skip' })
    expect(next).toHaveFocus()

    skip.focus()
    fireEvent.keyDown(skip, { key: 'Tab', bubbles: true })
    expect(next).toHaveFocus()
  })

  it('traps Shift+Tab the same way, wrapping from the first focusable back to the last', () => {
    mockPlatform({ reducedMotion: true })
    renderTour()

    clickNext() // welcome -> coach-today
    const next = screen.getByRole('button', { name: 'Next' })
    const skip = screen.getByRole('button', { name: 'Skip' })
    expect(next).toHaveFocus()

    fireEvent.keyDown(next, { key: 'Tab', shiftKey: true, bubbles: true })
    expect(skip).toHaveFocus()
  })

  it('returns focus to what had it before the tour opened, once the tour closes', () => {
    // The tour previously returned focus nowhere on close; this is a new
    // correctness win from useOverlay, not a preserved behavior.
    mockPlatform()
    const opener = document.createElement('button')
    opener.textContent = 'Tour Marked.'
    document.body.appendChild(opener)
    opener.focus()
    expect(opener).toHaveFocus()

    const onFinish = vi.fn()
    const view = render(
      <>
        <div data-tour-id="open-settings" />
        <div data-tour-id="today-toggle" />
        <div data-tour-id="open-calendar" />
        <div data-tour-id="ledger-title" />
        <OnboardingTour onFinish={onFinish} />
      </>,
    )
    expect(opener).not.toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onFinish).toHaveBeenCalledWith('skipped')

    // Home reacts to onFinish by unmounting the tour (tourActive -> false).
    view.unmount()

    expect(opener).toHaveFocus()
    opener.remove()
  })

  it('leads from the intro straight to the primary daily control, not another intro slide or a settings detour', () => {
    mockPlatform()
    renderTour()

    clickNext() // welcome -> coach-today
    expect(screen.getByText(/flip today's mark/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Marked.' })).not.toBeInTheDocument()
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
    // open-calendar's stub rect has top: 40 -- symmetric padding puts the
    // spotlight's top 10px above that, at 30, on every step alike.
    expect(document.querySelector('.tour-spotlight')).toHaveStyle({ top: '30px' })
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

  it("centers the spotlight on the target's own center regardless of the target's shape -- padding is symmetric, never a per-target offset", () => {
    mockPlatform()
    // A wide, short rect -- deliberately not square, unlike every stub in
    // mockDistinctTourRects, so an asymmetric-padding bug (equal-looking
    // by accident on a square target) has nowhere to hide.
    const rect = { top: 300, left: 20, width: 320, height: 40, bottom: 340, right: 340 } as DOMRect
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const isTarget = this.getAttribute('data-tour-id') === 'today-toggle'
      const r = isTarget ? rect : ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 } as DOMRect)
      return { ...r, x: r.left, y: r.top, toJSON: () => {} }
    })
    renderTour()

    clickNext() // welcome -> coach-today

    // Exactly 10px on every side...
    expect(document.querySelector('.tour-spotlight')).toHaveStyle({
      top: '290px',
      left: '10px',
      width: '340px',
      height: '60px',
    })

    // ...which is what makes the spotlight's own center land exactly on
    // the target's center, for this or any other target shape. A
    // per-target offset (the old calendar-only hack this test replaces)
    // would move the center away from the target instead.
    const spotlight = document.querySelector('.tour-spotlight')!
    const spotlightStyle = getComputedStyle(spotlight)
    const spotlightCenterX = parseFloat(spotlightStyle.left) + parseFloat(spotlightStyle.width) / 2
    const spotlightCenterY = parseFloat(spotlightStyle.top) + parseFloat(spotlightStyle.height) / 2
    expect(spotlightCenterX).toBe(rect.left + rect.width / 2)
    expect(spotlightCenterY).toBe(rect.top + rect.height / 2)
  })

  it("anchors the callout horizontally on the target's own center when the viewport has room, rather than the middle of the screen", () => {
    mockPlatform()
    // jsdom's default viewport is 1024px wide; a target sitting well
    // inside it (nowhere near either edge) should pull the callout to its
    // own center rather than leaving it pinned to screen-center.
    const rect = { top: 100, left: 300, width: 40, height: 40, bottom: 140, right: 340 } as DOMRect
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const isTarget = this.getAttribute('data-tour-id') === 'today-toggle'
      const r = isTarget ? rect : ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 } as DOMRect)
      return { ...r, x: r.left, y: r.top, toJSON: () => {} }
    })
    renderTour()

    clickNext() // welcome -> coach-today

    const targetCenterX = rect.left + rect.width / 2
    expect(document.querySelector('.tour-callout')).toHaveStyle({ left: `${targetCenterX}px` })
  })

  it('clamps the callout inside the safe viewport margin instead of following a target all the way to the edge', () => {
    mockPlatform()
    // A target hugging the right edge of jsdom's 1024px-wide viewport --
    // anchoring exactly to its center would push most of the card off-screen.
    const rect = { top: 100, left: 1000, width: 20, height: 20, bottom: 120, right: 1020 } as DOMRect
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const isTarget = this.getAttribute('data-tour-id') === 'today-toggle'
      const r = isTarget ? rect : ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 } as DOMRect)
      return { ...r, x: r.left, y: r.top, toJSON: () => {} }
    })
    renderTour()

    clickNext() // welcome -> coach-today

    // Half the callout's own max width (22rem = 352px, at 16px margins on
    // a 1024px viewport neither dimension clips the other) short of the
    // right edge -- the card's own edge lands on the safe margin, not its
    // center on the target.
    const halfWidth = 352 / 2
    const clampedCenterX = 1024 - 16 - halfWidth
    expect(document.querySelector('.tour-callout')).toHaveStyle({ left: `${clampedCenterX}px` })
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
    // "Got it" rather than "Done": Marked. has no way to confirm the user
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

  describe('background isolation', () => {
    /**
     * Mirrors main.tsx's real DOM shape: `<App/>` (standing in for Home
     * here) and `<UpdatePrompt/>` are unrelated siblings under the same
     * React root, neither one a descendant of the other -- exactly the
     * topology the previous `isolateBackground: false` + hand-rolled
     * `inert` on Home's own `<main>` could not reach (MAKER428.md's
     * outstanding compliance issue this migration closes). Portalling the
     * tour to document.body (see OnboardingTour's return statement) is what
     * lets the package's real isolation cover both siblings alike, without
     * either one needing to know the tour exists.
     */
    function renderWithSiblings(onFinish = vi.fn()) {
      const view = render(
        <>
          <main>
            <div data-tour-id="open-settings" />
            <div data-tour-id="today-toggle" />
            <div data-tour-id="open-calendar" />
            <div data-tour-id="ledger-title" />
            <button type="button">Home control</button>
          </main>
          {/* Stands in for UpdatePrompt: a real interactive sibling that is
              not inside Home/<main> at all, and has no idea the tour
              exists -- see main.tsx, where `<UpdatePrompt/>` renders beside
              `<App/>`, not inside it. */}
          <div role="status">
            <button type="button">Reload</button>
          </div>
          <OnboardingTour onFinish={onFinish} />
        </>,
      )
      return { onFinish, ...view }
    }

    it('makes every sibling outside the tour unreachable -- including one that is not inside Home, e.g. UpdatePrompt', () => {
      mockPlatform()
      renderWithSiblings()

      // Not merely visually covered: genuinely excluded from a normal,
      // accessibility-respecting query, exactly like a real screen reader
      // would experience it.
      expect(screen.queryByRole('button', { name: 'Home control' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()

      // Still genuinely present in the DOM -- isolated, not removed -- so
      // this is proving real inert/aria-hidden isolation, not a mount gate.
      expect(screen.getByRole('button', { name: 'Home control', hidden: true })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reload', hidden: true })).toBeInTheDocument()

      // The tour's own controls are unaffected by its own isolation.
      expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
    })

    it('keeps Tab trapped in the tour even with reachable-looking siblings in the DOM -- jsdom does not enforce inert, so this is the trap actually doing the work', () => {
      mockPlatform({ reducedMotion: true })
      renderWithSiblings()

      clickNext() // welcome -> coach-today
      const next = screen.getByRole('button', { name: 'Next' })
      const skip = screen.getByRole('button', { name: 'Skip' })
      expect(next).toHaveFocus()

      skip.focus()
      fireEvent.keyDown(skip, { key: 'Tab', bubbles: true })
      expect(next).toHaveFocus()

      fireEvent.keyDown(next, { key: 'Tab', shiftKey: true, bubbles: true })
      expect(skip).toHaveFocus()
    })

    it('cleans up isolation on close, restoring every sibling to reachable', () => {
      mockPlatform()
      const { onFinish, rerender } = renderWithSiblings()

      expect(screen.queryByRole('button', { name: 'Home control' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
      expect(onFinish).toHaveBeenCalledWith('skipped')

      // Home reacts to onFinish by unmounting only the tour (tourActive ->
      // false) -- the siblings themselves stay mounted throughout, exactly
      // as they do in the real app.
      rerender(
        <>
          <main>
            <button type="button">Home control</button>
          </main>
          <div role="status">
            <button type="button">Reload</button>
          </div>
        </>,
      )

      expect(screen.getByRole('button', { name: 'Home control' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    })
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
      fireEvent.click(screen.getByRole('button', { name: 'Marked.' }))
      fireAnimationEnd(document.querySelector('.onboarding-intro')!, 'onboarding-intro-leave')
    }

    it('holds the welcome screen while its exit fade plays, then advances when the fade reports done', () => {
      renderStaged()

      fireEvent.click(screen.getByRole('button', { name: 'Marked.' }))

      // Still the intro, now leaving -- no coach copy yet, no hard cut.
      expect(document.querySelector('.onboarding-intro-leaving')).toBeInTheDocument()
      expect(screen.queryByText(/flip today's mark/i)).not.toBeInTheDocument()

      fireAnimationEnd(document.querySelector('.onboarding-intro')!, 'onboarding-intro-leave')

      expect(screen.getByText(/flip today's mark/i)).toBeInTheDocument()
    })

    it('advances from the welcome screen immediately under reduced motion, where the exit fade would never play', () => {
      renderStaged({ reducedMotion: true })

      fireEvent.click(screen.getByRole('button', { name: 'Marked.' }))

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
      // Same symmetric padding as the replay: open-calendar's stub rect
      // has top: 40, so the spotlight's top sits at 30.
      expect(document.querySelector('.tour-spotlight')).toHaveStyle({ top: '30px' })
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
      pressEscape()
      expect(onFinish).not.toHaveBeenCalled()

      fireAnimationEnd(document.querySelector('.onboarding-coach')!, 'onboarding-close')
      expect(onFinish).toHaveBeenCalledWith('completed')
      expect(onFinish).toHaveBeenCalledTimes(1)
    })
  })
})
