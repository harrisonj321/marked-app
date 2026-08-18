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
  /** Overrides the spotlight's top padding only, e.g. to stay clear of the fixed top bar above it. */
  spotlightTopPaddingPx?: number
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
    // The real "Open calendar" button sits close enough to the top bar
    // that padding the spotlight's usual amount on top would reach into
    // Skip's normal, unmoved position. The button's own icon glyph
    // doesn't start until partway down its 44px box (centered inside),
    // and Skip's own text glyph ends partway up its box -- so insetting
    // the spotlight's top edge into that shared padding still fully
    // covers both real glyphs while clearing Skip, without moving Skip,
    // the button, or the icon.
    spotlightTopPaddingPx: -10,
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
}

/**
 * Drives the first-run/replayable tour: one staged full-screen intro, four
 * coach marks anchored to real, on-screen controls, then an optional PWA
 * install step. Always runs over a screen that stays mounted (and inert)
 * underneath the whole time -- the real Home for Settings' "Tour Noted."
 * replay, or the neutral demo shell for the pre-auth orientation (see
 * OnboardingOrientation) -- so this component only ever needs to render
 * whichever single step is current. The one exception to "single step"
 * thinking: all four coach steps share one persistent CoachOverlay so the
 * spotlight element survives step changes and its CSS position transition
 * glides it from control to control.
 */
export function OnboardingTour({ onFinish }: OnboardingTourProps) {
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onFinish('skipped')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onFinish])

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
    if (isLastStep) {
      onFinish('completed')
      return
    }
    setIndex((current) => current + 1)
  }

  function skip() {
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
      {step === 'welcome' && <IntroStep onPrimary={goNext} />}

      {isCoachStep(step) && (
        <CoachOverlay
          step={step}
          config={COACH_STEPS[step]}
          primaryLabel={isLastStep ? 'Done' : 'Next'}
          onPrimary={goNext}
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

      <TourTopbar index={index} total={steps.length} onSkip={step === 'install' ? undefined : skip} />
    </>
  )
}

interface TourTopbarProps {
  index: number
  total: number
  onSkip?: () => void
}

function TourTopbar({ index, total, onSkip }: TourTopbarProps) {
  return (
    <div className="onboarding-topbar">
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
}

/**
 * The one brand moment Noted. allows itself. The wordmark rises, its period
 * stamps in with the same spring the today-toggle settles with, and the
 * five lines land one at a time -- what it isn't in muted ink, what it is
 * in full ink. The primary action reads "Noted." because pressing it is the
 * product's whole gesture: acknowledge, move on.
 *
 * Focus follows visibility: while the staged reveal is still holding the
 * footer at opacity 0, focus rests on the dialog itself (visible from the
 * first frame) and the hidden button is kept out of the tab order, so a
 * keyboard user never sits on -- or tabs onto -- a control that cannot be
 * seen. The primary takes focus once its entrance settles (see
 * useEntranceSettled for the finished/cancelled/reduced-motion cases).
 */
function IntroStep({ onPrimary }: IntroStepProps) {
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

  return (
    <div
      ref={containerRef}
      className="onboarding-intro"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      tabIndex={-1}
    >
      <div className="onboarding-intro-body">
        {/* Explicit label: the period span's inline-block display can make
            some accessible-name computations insert whitespace ("Noted .");
            the name must read exactly "Noted." regardless of layout. */}
        <h2 id={headingId} className="onboarding-wordmark" aria-label="Noted.">
          Noted<span className="onboarding-wordmark-period">.</span>
        </h2>
        <div className="onboarding-lines">
          <p className="onboarding-line">It's not a habit tracker.</p>
          <p className="onboarding-line">It's not about keeping score.</p>
          <p className="onboarding-line onboarding-line-turn">It's just a ledger of whatever.</p>
          <p className="onboarding-line onboarding-line-turn">It's just visibility.</p>
          <p className="onboarding-line onboarding-line-turn">It's just Noted.</p>
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
          Noted.
        </button>
      </div>
    </div>
  )
}

const SPOTLIGHT_PADDING_PX = 10
const CALLOUT_GAP_PX = 16

interface CoachOverlayProps {
  step: CoachStepId
  config: CoachStepConfig
  primaryLabel: string
  onPrimary: () => void
}

/**
 * One overlay for all coach steps. The spotlight div is deliberately
 * unkeyed so React reuses it across steps and its CSS transition glides it
 * to the next control; the callout is keyed per step so it remounts, which
 * both re-runs its entrance fade and moves focus onto the new step's
 * primary action.
 */
function CoachOverlay({ step, config, primaryLabel, onPrimary }: CoachOverlayProps) {
  const rect = useTourTargetRect(config.tourId)
  const spotlightTopPaddingPx = config.spotlightTopPaddingPx ?? SPOTLIGHT_PADDING_PX

  const placeBelow = !rect || rect.top < window.innerHeight / 2

  return (
    <div className="onboarding-coach">
      {rect && (
        <div
          className="tour-spotlight"
          aria-hidden="true"
          style={{
            top: rect.top - spotlightTopPaddingPx,
            left: rect.left - SPOTLIGHT_PADDING_PX,
            width: rect.width + SPOTLIGHT_PADDING_PX * 2,
            height: rect.height + spotlightTopPaddingPx + SPOTLIGHT_PADDING_PX,
          }}
        />
      )}
      <CoachCallout
        key={step}
        label={config.label}
        body={config.body}
        primaryLabel={primaryLabel}
        onPrimary={onPrimary}
        style={
          rect
            ? placeBelow
              ? { top: rect.bottom + SPOTLIGHT_PADDING_PX + CALLOUT_GAP_PX }
              : { bottom: window.innerHeight - rect.top + SPOTLIGHT_PADDING_PX + CALLOUT_GAP_PX }
            : { top: '50%', transform: 'translate(-50%, -50%)' }
        }
      />
    </div>
  )
}

interface CoachCalloutProps {
  label: string
  body: string
  primaryLabel: string
  onPrimary: () => void
  style: React.CSSProperties
}

/**
 * Focus waits for the callout's entrance fade to settle (see IntroStep for
 * the rationale: the focused control must be visible when the ring
 * appears). Until then focus rests wherever the previous step left it --
 * the topbar's aria-live region covers the announcement gap.
 */
function CoachCallout({ label, body, primaryLabel, onPrimary, style }: CoachCalloutProps) {
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
        <button type="button" className="onboarding-primary" ref={primaryRef} onClick={onPrimary}>
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
            Add Noted. to your Home Screen if you want it to live alongside your other apps: tap{' '}
            <ShareIcon size={16} /> Share, then &ldquo;Add to Home Screen.&rdquo;
          </p>
        ) : (
          <p>Add Noted. to your Home Screen if you want it to live alongside your other apps.</p>
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
            // Noted. cannot verify that Safari's Add to Home Screen steps
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
