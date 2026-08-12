import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { OnboardingStatus } from '../domain/onboarding'
import { useInstallPrompt, type InstallPromptOutcome } from '../hooks/useInstallPrompt'
import { useTourTargetRect } from '../hooks/useTourTargetRect'
import { isIOSDevice, isStandaloneDisplay } from '../lib/platform'
import { ShareIcon } from './icons'

type StepId = 'welcome' | 'concept' | 'coach-today' | 'coach-calendar' | 'install'

const INTRO_AND_COACH_STEPS: readonly StepId[] = ['welcome', 'concept', 'coach-today', 'coach-calendar']

interface OnboardingTourProps {
  onFinish: (status: OnboardingStatus) => void
}

/**
 * Drives the first-run/replayable tour: two full-screen intro slides, two
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

  function goBack() {
    setIndex((current) => Math.max(0, current - 1))
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
            'A simple ledger for anything you want to notice over time.',
            "It doesn't score, judge, or tell you what your days should mean — it just keeps the record.",
          ]}
          primaryLabel="Next"
          onPrimary={goNext}
        />
      )}

      {step === 'concept' && (
        <IntroStep
          title="How it works"
          paragraphs={[
            'Choose something you want to notice — anything at all.',
            'Each day gets marked one way or the other. Neither mark is good or bad.',
            'Over time, the pattern becomes visible. What it means is yours to decide.',
          ]}
          primaryLabel="Next"
          onPrimary={goNext}
          onBack={goBack}
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
          body="Open the calendar to see, or correct, any past day."
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

      <TourTopbar
        index={index}
        total={steps.length}
        onSkip={step === 'install' ? undefined : skip}
        // The calendar coach mark spotlights the real "Open calendar"
        // control, which sits in the same top-right corner Skip normally
        // occupies -- clustering Skip next to the dots instead keeps it
        // clear of that spotlight without touching spotlight geometry or
        // restructuring the top bar for every other step.
        tight={step === 'coach-calendar'}
      />
    </>
  )
}

interface TourTopbarProps {
  index: number
  total: number
  onSkip?: () => void
  /** Clusters Skip next to the dots instead of the far corner -- see the coach-calendar call site. */
  tight?: boolean
}

function TourTopbar({ index, total, onSkip, tight }: TourTopbarProps) {
  return (
    <div className={tight ? 'onboarding-topbar onboarding-topbar-tight' : 'onboarding-topbar'}>
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
  onBack?: () => void
}

function IntroStep({ title, paragraphs, primaryLabel, onPrimary, onBack }: IntroStepProps) {
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
        {onBack && (
          <button type="button" className="onboarding-back" onClick={onBack}>
            Back
          </button>
        )}
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
}

function CoachStep({ tourId, label, body, primaryLabel, onPrimary }: CoachStepProps) {
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
            top: rect.top - SPOTLIGHT_PADDING_PX,
            left: rect.left - SPOTLIGHT_PADDING_PX,
            width: rect.width + SPOTLIGHT_PADDING_PX * 2,
            height: rect.height + SPOTLIGHT_PADDING_PX * 2,
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
