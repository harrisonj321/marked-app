import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { OnboardingStatus } from '../domain/onboarding'
import { useInstallPrompt, type InstallPromptOutcome } from '../hooks/useInstallPrompt'
import { useTourTargetRect } from '../hooks/useTourTargetRect'
import { isIOSDevice, isStandaloneDisplay } from '../lib/platform'
import { ShareIcon } from './icons'

type StepId = 'welcome' | 'coach-customize' | 'coach-today' | 'coach-calendar' | 'install'

const INTRO_AND_COACH_STEPS: readonly StepId[] = [
  'welcome',
  'coach-customize',
  'coach-today',
  'coach-calendar',
]

interface OnboardingTourProps {
  onFinish: (status: OnboardingStatus) => void
}

/**
 * Drives the first-run/replayable tour: one full-screen intro slide, three
 * coach marks anchored to the real Home controls, then an optional PWA
 * install step. Home stays mounted (and inert) underneath the whole time --
 * see Home's use of the `inert` attribute -- so this component only ever
 * needs to render whichever single step is current.
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
  const step = steps[index]
  const isLastStep = index === steps.length - 1

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
      {step === 'welcome' && (
        <IntroStep
          title="Noted."
          paragraphs={[
            "It's not a habit tracker.\nIt's not about streaks, judgment, or value statements.",
            "It's just a ledger of whatever.\nIt's just visibility.\nIt's just Noted.",
          ]}
          primaryLabel="Next"
          onPrimary={goNext}
        />
      )}

      {step === 'coach-customize' && (
        <CoachStep
          tourId="open-settings"
          label="Make it yours"
          body="Name the two states whatever makes sense for what you're noting, and choose what an untouched day means."
          primaryLabel="Next"
          onPrimary={goNext}
        />
      )}

      {step === 'coach-today' && (
        <CoachStep
          tourId="today-toggle"
          label="Today"
          body="Tap or slide to change today's mark. You can change it anytime."
          primaryLabel="Next"
          onPrimary={goNext}
        />
      )}

      {step === 'coach-calendar' && (
        <CoachStep
          tourId="open-calendar"
          label="Calendar"
          body="Open the calendar to review or change any past day."
          primaryLabel={isLastStep ? 'Done' : 'Next'}
          onPrimary={goNext}
          // The real "Open calendar" button sits close enough to the top
          // bar that padding the spotlight's usual amount on top would
          // reach into Skip's normal, unmoved position. The button's own
          // icon glyph doesn't start until partway down its 44px box
          // (centered inside), and Skip's own text glyph ends partway up
          // its box -- so insetting the spotlight's top edge into that
          // shared padding still fully covers both real glyphs while
          // clearing Skip, without moving Skip, the button, or the icon.
          spotlightTopPaddingPx={-10}
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
  title: string
  paragraphs: string[]
  primaryLabel: string
  onPrimary: () => void
}

function IntroStep({ title, paragraphs, primaryLabel, onPrimary }: IntroStepProps) {
  const headingId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    primaryRef.current?.focus()
  }, [])

  return (
    <div className="onboarding-intro" role="dialog" aria-modal="true" aria-labelledby={headingId}>
      <div className="onboarding-intro-body">
        <h2 id={headingId}>{title}</h2>
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <div className="onboarding-footer">
        <button type="button" className="onboarding-primary" ref={primaryRef} onClick={onPrimary}>
          {primaryLabel}
        </button>
      </div>
    </div>
  )
}

const SPOTLIGHT_PADDING_PX = 10
const CALLOUT_GAP_PX = 16

interface CoachStepProps {
  tourId: string
  label: string
  body: string
  primaryLabel: string
  onPrimary: () => void
  /** Overrides the spotlight's top padding only, e.g. to stay clear of the fixed top bar above it. */
  spotlightTopPaddingPx?: number
}

function CoachStep({
  tourId,
  label,
  body,
  primaryLabel,
  onPrimary,
  spotlightTopPaddingPx = SPOTLIGHT_PADDING_PX,
}: CoachStepProps) {
  const rect = useTourTargetRect(tourId)
  const headingId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    primaryRef.current?.focus()
  }, [])

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
      <div
        className="tour-callout"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        style={
          rect
            ? placeBelow
              ? { top: rect.bottom + SPOTLIGHT_PADDING_PX + CALLOUT_GAP_PX }
              : { bottom: window.innerHeight - rect.top + SPOTLIGHT_PADDING_PX + CALLOUT_GAP_PX }
            : { top: '50%', transform: 'translate(-50%, -50%)' }
        }
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
