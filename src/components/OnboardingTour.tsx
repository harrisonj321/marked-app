import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { OnboardingStatus } from '../domain/onboarding'
import { useInstallPrompt, type InstallPromptOutcome } from '../hooks/useInstallPrompt'
import { useTourTargetRect } from '../hooks/useTourTargetRect'
import { isIOSDevice, isStandaloneDisplay, prefersReducedMotion } from '../lib/platform'
import { ShareIcon } from './icons'

/**
 * True once the given element's named CSS entrance animation is over --
 * finished, cancelled, or never going to run. Focus is only moved onto a
 * staged control once this settles, so a focus ring can never appear on a
 * control that is still being held invisible by its animation delay.
 *
 * Starts settled when reduced motion strips the animations (there would be
 * no animationend to wait for), and also treats animationcancel as settled:
 * if reduced motion flips on mid-entrance (e.g. battery saver), the CSS
 * media block stops applying, everything becomes instantly visible, and the
 * cancelled animation must still open the gate. Native listeners rather
 * than React props because React has no onAnimationCancel.
 */
function useEntranceSettled(
  ref: React.RefObject<HTMLElement | null>,
  animationName: string,
): boolean {
  const [settled, setSettled] = useState(prefersReducedMotion)

  useEffect(() => {
    if (settled) {
      return
    }
    const element = ref.current
    if (!element) {
      return
    }
    function handle(event: AnimationEvent) {
      if (event.animationName === animationName) {
        setSettled(true)
      }
    }
    element.addEventListener('animationend', handle)
    element.addEventListener('animationcancel', handle)
    return () => {
      element.removeEventListener('animationend', handle)
      element.removeEventListener('animationcancel', handle)
    }
  }, [settled, ref, animationName])

  return settled
}

type CoachStepId = 'coach-today' | 'coach-calendar' | 'coach-customize' | 'coach-ledger'
type StepId = 'welcome' | CoachStepId | 'install'

/**
 * The staged orientation's scene names, mirrored onto the demo shell (see
 * OnboardingOrientation) as a `data-stage` attribute so CSS can stage which
 * parts of the interface have arrived. 'closing' is the one stage with no
 * step of its own: the brief full-ink beat after Done, before onFinish.
 */
export type OrientationStage =
  | 'welcome'
  | 'today'
  | 'calendar'
  | 'settings'
  | 'ledger'
  | 'install'
  | 'closing'

const STAGE_BY_STEP: Record<StepId, OrientationStage> = {
  welcome: 'welcome',
  'coach-today': 'today',
  'coach-calendar': 'calendar',
  'coach-customize': 'settings',
  'coach-ledger': 'ledger',
  install: 'install',
}

/**
 * Coach order follows the product's importance hierarchy, not screen
 * geometry: the daily mark first (the whole product), then the record it
 * accumulates into, then the wording -- a detail, so it comes last before
 * the optional capability, multiple ledgers, which comes last of all: most
 * users only ever have the one ledger this tour already walked them
 * through, so the affordance to switch or add another is a quiet mention on
 * the way out rather than an early, prominent stop.
 */
const COACH_SEQUENCE: readonly CoachStepId[] = [
  'coach-today',
  'coach-calendar',
  'coach-customize',
  'coach-ledger',
]

const INTRO_AND_COACH_STEPS: readonly StepId[] = ['welcome', ...COACH_SEQUENCE]

interface CoachStepConfig {
  tourId: string
  label: string
  body: string
}

const COACH_STEPS: Record<CoachStepId, CoachStepConfig> = {
  'coach-today': {
    tourId: 'today-toggle',
    label: 'Today',
    body: "Tap or slide to flip today's mark. Change it anytime.",
  },
  'coach-calendar': {
    tourId: 'open-calendar',
    label: 'The record',
    // "a past day", not "any": days before the tracker's start date are
    // not editable, and the replayable tour reaches users for whom such
    // days are visible on the calendar.
    body: 'The pattern, at a glance. Tap a past day to correct it.',
    // This step's spotlight sits close beneath the fixed top bar, but
    // never needs to inset itself to stay clear of Skip: the top bar
    // renders at a higher z-index than the veil (see .onboarding-topbar
    // vs .onboarding-coach in index.css), so Skip stays visible and
    // clickable no matter where the cutout falls beneath it.
  },
  'coach-customize': {
    tourId: 'open-settings',
    label: 'Your words',
    body: "Rename the two states to fit what you're noting, and choose what an untouched day means.",
  },
  'coach-ledger': {
    tourId: 'ledger-title',
    label: 'More to note?',
    body: 'Tap the name to switch ledgers or add another.',
  },
}

function isCoachStep(step: StepId): step is CoachStepId {
  return step in COACH_STEPS
}

interface OnboardingTourProps {
  onFinish: (status: OnboardingStatus) => void
  /**
   * How the coach steps present themselves.
   *
   * 'spotlight' (the default, used by Settings' "Tour Marked." replay over
   * the real Home): a dimming backdrop with a cutout gliding between the
   * actual controls, and a callout card near each one -- annotation of a
   * real screen the user already lives in.
   *
   * 'staged' (the pre-auth orientation over the demo shell): the same
   * spotlight-and-callout targeting -- a first-time user must be able to
   * glance at a step and know exactly which control the words refer to --
   * but softened and set inside one continuous scene: a warmer veil, the
   * shell assembling element by element underneath (driven through
   * onStageChange -> data-stage CSS) so each new subject arrives inside
   * the cutout, quiet intermediate Nexts with the accent fill reserved
   * for Done, and soft intro/finale exit beats.
   */
  presentation?: 'spotlight' | 'staged'
  /** Staged presentation only: reports the current scene so the host shell can stage itself. */
  onStageChange?: (stage: OrientationStage) => void
}

/**
 * Drives the first-run/replayable tour: one staged full-screen intro, four
 * coach marks anchored to real, on-screen controls, then an optional PWA
 * install step. Always runs over a screen that stays mounted (and inert)
 * underneath the whole time -- the real Home for Settings' "Tour Marked."
 * replay, or the neutral demo shell for the pre-auth orientation (see
 * OnboardingOrientation) -- so this component only ever needs to render
 * whichever single step is current. The one exception to "single step"
 * thinking: all four coach steps share one persistent CoachOverlay so the
 * spotlight element survives step changes and its CSS position transition
 * glides it from control to control -- in both presentations; staged mode
 * only softens the overlay's veil and button emphasis, never its
 * targeting.
 */
export function OnboardingTour({ onFinish, presentation = 'spotlight', onStageChange }: OnboardingTourProps) {
  const { canPromptInstall, promptInstall } = useInstallPrompt()
  // Display mode and device class cannot meaningfully change while the tour
  // is open, so these are read once rather than re-derived every render.
  const [standalone] = useState(isStandaloneDisplay)
  const [ios] = useState(isIOSDevice)
  const showInstallStep = !standalone && (ios || canPromptInstall)

  const steps = useMemo<StepId[]>(
    () => (showInstallStep ? [...INTRO_AND_COACH_STEPS, 'install'] : [...INTRO_AND_COACH_STEPS]),
    [showInstallStep],
  )

  const [index, setIndex] = useState(0)
  // Clamped: the steps array can shrink under a live index in one rare case
  // (`appinstalled` firing while the install step is open resets the install
  // prompt, dropping that step), and a momentary out-of-range read would
  // blank the whole overlay.
  const step = steps[Math.min(index, steps.length - 1)]
  const isLastStep = index >= steps.length - 1

  // Staged presentation's two exit beats. Both are held only while their CSS
  // animation plays and both are skipped entirely (state never set) when
  // reduced motion would strip that animation -- the animationend that
  // releases them would otherwise never fire.
  const [introLeaving, setIntroLeaving] = useState(false)
  const [closing, setClosing] = useState(false)

  const staged = presentation === 'staged'

  // An effect, not an inline call: the host shell stores the stage in its
  // own state, and setting a parent's state during this component's render
  // is illegal in React.
  useEffect(() => {
    if (staged && onStageChange) {
      onStageChange(closing ? 'closing' : STAGE_BY_STEP[step])
    }
  }, [staged, onStageChange, step, closing])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !closing) {
        onFinish('skipped')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onFinish, closing])

  // Background scroll would otherwise fight the fixed-position overlay on
  // long-content phones; restored on unmount regardless of how the tour ends.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  function goNext() {
    if (closing) {
      return
    }
    if (isLastStep) {
      // The staged finale: the assembled interface breathes to full ink for
      // a beat and then the whole scene exhales, before sign-in. Spotlight
      // replays (and reduced motion) finish plainly, as they always have.
      if (staged && !prefersReducedMotion()) {
        setClosing(true)
        return
      }
      onFinish('completed')
      return
    }
    setIndex((current) => current + 1)
  }

  function handleIntroPrimary() {
    if (introLeaving) {
      return
    }
    // Staged, the intro's lines fade off the paper before the shell begins
    // arriving on it -- one scene, no hard cut. goNext runs when the exit
    // animation reports done (see IntroStep's leaving/onLeft).
    if (staged && !prefersReducedMotion()) {
      setIntroLeaving(true)
      return
    }
    goNext()
  }

  function handleIntroLeft() {
    setIntroLeaving(false)
    goNext()
  }

  function skip() {
    if (closing) {
      return
    }
    onFinish('skipped')
  }

  function finishFromInstall() {
    onFinish('completed')
  }

  async function handleAddToHomeScreen(): Promise<InstallPromptOutcome> {
    const outcome = await promptInstall()
    onFinish('completed')
    return outcome
  }

  return (
    <>
      {step === 'welcome' && (
        <IntroStep onPrimary={handleIntroPrimary} leaving={introLeaving} onLeft={handleIntroLeft} />
      )}

      {isCoachStep(step) && (
        <CoachOverlay
          step={step}
          config={COACH_STEPS[step]}
          primaryLabel={isLastStep ? 'Done' : 'Next'}
          onPrimary={goNext}
          staged={staged}
          final={isLastStep}
          closing={closing}
          onClosed={() => onFinish('completed')}
        />
      )}

      {step === 'install' && (
        <InstallStep
          ios={ios}
          canPromptInstall={canPromptInstall}
          onAddToHomeScreen={handleAddToHomeScreen}
          onNotNow={finishFromInstall}
        />
      )}

      <TourTopbar
        index={index}
        total={steps.length}
        closing={closing}
        onSkip={step === 'install' || closing ? undefined : skip}
      />
    </>
  )
}

interface TourTopbarProps {
  index: number
  total: number
  /** Fades the bar out with the rest of the staged finale. */
  closing?: boolean
  onSkip?: () => void
}

function TourTopbar({ index, total, closing = false, onSkip }: TourTopbarProps) {
  return (
    <div className={closing ? 'onboarding-topbar onboarding-closing' : 'onboarding-topbar'}>
      <div className="onboarding-dots" aria-hidden="true">
        {Array.from({ length: total }, (_, dotIndex) => (
          <span
            key={dotIndex}
            className={dotIndex === index ? 'onboarding-dot onboarding-dot-active' : 'onboarding-dot'}
          />
        ))}
      </div>
      <span className="visually-hidden" aria-live="polite">{`Step ${index + 1} of ${total}`}</span>
      {onSkip && (
        <button type="button" className="onboarding-skip" onClick={onSkip}>
          Skip
        </button>
      )}
    </div>
  )
}

interface IntroStepProps {
  onPrimary: () => void
  /**
   * Staged presentation's exit beat: true while the intro's lines fade off
   * the paper. onLeft fires when that fade's animation reports done --
   * finished or cancelled -- and never needs a reduced-motion fallback here
   * because the caller only ever sets leaving when the animation will play
   * (see handleIntroPrimary).
   */
  leaving?: boolean
  onLeft?: () => void
}

/**
 * The one brand moment Marked. allows itself. The wordmark rises, its period
 * stamps in with the same spring the today-toggle settles with, and the
 * five lines land one at a time -- what it isn't in muted ink, what it is
 * in full ink. The primary action reads "Marked." because pressing it is the
 * product's whole gesture: acknowledge, move on.
 *
 * Focus follows visibility: while the staged reveal is still holding the
 * footer at opacity 0, focus rests on the dialog itself (visible from the
 * first frame) and the hidden button is kept out of the tab order, so a
 * keyboard user never sits on -- or tabs onto -- a control that cannot be
 * seen. The primary takes focus once its entrance settles (see
 * useEntranceSettled for the finished/cancelled/reduced-motion cases).
 */
function IntroStep({ onPrimary, leaving = false, onLeft }: IntroStepProps) {
  const headingId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const revealed = useEntranceSettled(footerRef, 'onboarding-rise')

  useEffect(() => {
    if (revealed) {
      primaryRef.current?.focus()
    } else {
      containerRef.current?.focus()
    }
  }, [revealed])

  // Native listeners for the same reason as useEntranceSettled: React has
  // no onAnimationCancel, and a fade cancelled mid-flight (reduced motion
  // flipping on) must still release the step.
  useEffect(() => {
    if (!leaving || !onLeft) {
      return
    }
    const element = containerRef.current
    if (!element) {
      return
    }
    function handle(event: AnimationEvent) {
      if (event.animationName === 'onboarding-intro-leave') {
        onLeft?.()
      }
    }
    element.addEventListener('animationend', handle)
    element.addEventListener('animationcancel', handle)
    return () => {
      element.removeEventListener('animationend', handle)
      element.removeEventListener('animationcancel', handle)
    }
  }, [leaving, onLeft])

  return (
    <div
      ref={containerRef}
      className={leaving ? 'onboarding-intro onboarding-intro-leaving' : 'onboarding-intro'}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      tabIndex={-1}
    >
      <div className="onboarding-intro-body">
        {/* Explicit label: the period span's inline-block display can make
            some accessible-name computations insert whitespace ("Marked .");
            the name must read exactly "Marked." regardless of layout. */}
        <h2 id={headingId} className="onboarding-wordmark" aria-label="Marked.">
          Marked<span className="onboarding-wordmark-period">.</span>
        </h2>
        <div className="onboarding-lines">
          <p className="onboarding-line">It's not a habit tracker.</p>
          <p className="onboarding-line">It's not about keeping score.</p>
          <p className="onboarding-line onboarding-line-turn">It's just a ledger of whatever.</p>
          <p className="onboarding-line onboarding-line-turn">It's just visibility.</p>
          <p className="onboarding-line onboarding-line-turn">It's just Marked.</p>
        </div>
      </div>
      <div ref={footerRef} className="onboarding-footer onboarding-intro-footer">
        <button
          type="button"
          className="onboarding-primary"
          ref={primaryRef}
          onClick={onPrimary}
          tabIndex={revealed ? undefined : -1}
        >
          Marked.
        </button>
      </div>
    </div>
  )
}

const SPOTLIGHT_PADDING_PX = 10
const CALLOUT_GAP_PX = 16
// Mirrors .tour-callout's own `width: min(22rem, calc(100vw - 2rem))` --
// kept as plain px constants (at the app's one, unchanged root font size)
// rather than read from computed style, matching how SPOTLIGHT_PADDING_PX
// and CALLOUT_GAP_PX already shadow their rem-based CSS counterparts.
const CALLOUT_MAX_WIDTH_PX = 352
const CALLOUT_VIEWPORT_MARGIN_PX = 16

interface CoachOverlayProps {
  step: CoachStepId
  config: CoachStepConfig
  primaryLabel: string
  onPrimary: () => void
  /**
   * The staged orientation's softer dress on the same targeting: a warmer,
   * lighter veil (the shell underneath is mid-assembly, not a finished
   * screen) and quiet intermediate Nexts. Targeting itself -- cutout plus
   * adjacent callout -- is identical in both modes, because that adjacency
   * is what makes "this control -> this explanation" readable at a glance.
   */
  staged?: boolean
  /** True on the sequence's last step: its action regains the accent fill the intermediate Nexts give up (staged only). */
  final?: boolean
  /** Staged finale beat: the overlay fades as one piece while the shell holds full ink. */
  closing?: boolean
  /** Fires when the closing animation reports done -- see the closing effect below. */
  onClosed?: () => void
}

/**
 * One overlay for all coach steps. The spotlight div is deliberately
 * unkeyed so React reuses it across steps and its CSS transition glides it
 * to the next control; the callout is keyed per step so it remounts, which
 * both re-runs its entrance fade and moves focus onto the new step's
 * primary action.
 *
 * In staged mode this root also carries the finale: 'closing' swaps its
 * entrance animation for the shared onboarding-close fade, and that
 * animation's end/cancel event is what hands control back to the tour.
 * The tour only ever sets closing when the animation will actually play
 * (reduced motion finishes plainly instead), so no fallback timer is
 * needed here.
 */
function CoachOverlay({
  step,
  config,
  primaryLabel,
  onPrimary,
  staged = false,
  final = false,
  closing = false,
  onClosed,
}: CoachOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const rect = useTourTargetRect(config.tourId)

  const placeBelow = !rect || rect.top < window.innerHeight / 2

  // Centered on the target, not the screen, whenever there's room: the
  // callout should read as belonging to the control beneath it. Clamped
  // so it never crosses the same safe margin its own CSS width already
  // respects, which is what keeps a target near either edge (the
  // top-right calendar icon) from pushing the card half off-screen.
  const calloutHalfWidthPx =
    Math.min(CALLOUT_MAX_WIDTH_PX, window.innerWidth - CALLOUT_VIEWPORT_MARGIN_PX * 2) / 2
  const calloutCenterX = rect
    ? Math.min(
        Math.max(rect.left + rect.width / 2, CALLOUT_VIEWPORT_MARGIN_PX + calloutHalfWidthPx),
        window.innerWidth - CALLOUT_VIEWPORT_MARGIN_PX - calloutHalfWidthPx,
      )
    : null

  useEffect(() => {
    if (!closing || !onClosed) {
      return
    }
    const element = overlayRef.current
    if (!element) {
      return
    }
    function handle(event: AnimationEvent) {
      if (event.animationName === 'onboarding-close') {
        onClosed?.()
      }
    }
    element.addEventListener('animationend', handle)
    element.addEventListener('animationcancel', handle)
    return () => {
      element.removeEventListener('animationend', handle)
      element.removeEventListener('animationcancel', handle)
    }
  }, [closing, onClosed])

  const overlayClassName = [
    'onboarding-coach',
    staged ? 'onboarding-coach-staged' : '',
    closing ? 'onboarding-closing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={overlayRef} className={overlayClassName}>
      {rect && (
        // Padding is always the same amount on every side: the only way to
        // guarantee the cutout's visual center lands exactly on the
        // target's visual center, regardless of the target's own shape.
        <div
          className="tour-spotlight"
          aria-hidden="true"
          style={{
            top: rect.top - SPOTLIGHT_PADDING_PX,
            left: rect.left - SPOTLIGHT_PADDING_PX,
            width: rect.width + SPOTLIGHT_PADDING_PX * 2,
            height: rect.height + SPOTLIGHT_PADDING_PX * 2,
          }}
        />
      )}
      <CoachCallout
        key={step}
        label={config.label}
        body={config.body}
        primaryLabel={primaryLabel}
        quiet={staged && !final}
        onPrimary={onPrimary}
        style={
          rect
            ? {
                left: calloutCenterX ?? undefined,
                ...(placeBelow
                  ? { top: rect.bottom + SPOTLIGHT_PADDING_PX + CALLOUT_GAP_PX }
                  : { bottom: window.innerHeight - rect.top + SPOTLIGHT_PADDING_PX + CALLOUT_GAP_PX }),
              }
            : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
        }
      />
    </div>
  )
}

interface CoachCalloutProps {
  label: string
  body: string
  primaryLabel: string
  /** Quiet surface treatment for staged intermediate Nexts; the accent fill stays for the replay and for Done. */
  quiet?: boolean
  onPrimary: () => void
  style: React.CSSProperties
}

/**
 * Focus waits for the callout's entrance fade to settle (see IntroStep for
 * the rationale: the focused control must be visible when the ring
 * appears). Until then focus rests wherever the previous step left it --
 * the topbar's aria-live region covers the announcement gap.
 */
function CoachCallout({ label, body, primaryLabel, quiet = false, onPrimary, style }: CoachCalloutProps) {
  const headingId = useId()
  const calloutRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const entered = useEntranceSettled(calloutRef, 'onboarding-fade')

  useEffect(() => {
    if (entered) {
      primaryRef.current?.focus()
    }
  }, [entered])

  return (
    <div
      ref={calloutRef}
      className="tour-callout"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      style={style}
    >
      <p id={headingId} className="tour-callout-label">
        {label}
      </p>
      <p>{body}</p>
      <div className="tour-callout-actions">
        <button
          type="button"
          className={quiet ? undefined : 'onboarding-primary'}
          ref={primaryRef}
          onClick={onPrimary}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  )
}

interface InstallStepProps {
  ios: boolean
  canPromptInstall: boolean
  onAddToHomeScreen: () => Promise<InstallPromptOutcome>
  onNotNow: () => void
}

function InstallStep({ ios, canPromptInstall, onAddToHomeScreen, onNotNow }: InstallStepProps) {
  const headingId = useId()

  return (
    <div className="onboarding-install">
      <div className="onboarding-card" role="dialog" aria-modal="true" aria-labelledby={headingId}>
        {/* The actual icon the Home Screen would get -- concrete, not a
            generic illustration. Decorative here (alt=""): the heading and
            body carry the meaning. */}
        <img src="/icon-192.png" alt="" width={56} height={56} className="onboarding-install-icon" />
        <h2 id={headingId}>Keep it close</h2>
        {ios ? (
          <p>
            Add Marked. to your Home Screen if you want it to live alongside your other apps: tap{' '}
            <ShareIcon size={16} /> Share, then &ldquo;Add to Home Screen.&rdquo;
          </p>
        ) : (
          <p>Add Marked. to your Home Screen if you want it to live alongside your other apps.</p>
        )}
        <div className="onboarding-footer">
          <button type="button" className="onboarding-skip" onClick={onNotNow}>
            Not now
          </button>
          {canPromptInstall ? (
            <button type="button" className="onboarding-primary" onClick={() => void onAddToHomeScreen()}>
              Add to Home Screen
            </button>
          ) : (
            // Marked. cannot verify that Safari's Add to Home Screen steps
            // were actually completed, so this only acknowledges the
            // instructions rather than implying a confirmed install.
            <button type="button" className="onboarding-primary" onClick={onNotNow}>
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
