import { useEffect, useState } from 'react'
import { formatDisplayDate, getTodayKey, resolveDeviceTimezone } from '../domain/date'
import type { OnboardingStatus } from '../domain/onboarding'
import { prefersReducedMotion } from '../lib/platform'
import { DEFAULT_STATE_LABELS, type DayState } from '../domain/tracker'
import { OnboardingTour, type OrientationStage } from './OnboardingTour'
import { TodayToggle } from './TodayToggle'
import { CalendarIcon, ChevronDownIcon } from './icons'

interface OnboardingOrientationProps {
  onFinish: (status: OnboardingStatus) => void
}

/**
 * The full first-run tour, always run before any account exists -- see
 * App.tsx and CLAUDE.md's "onboarding/orientation before auth" requirement.
 *
 * Runs the tour in its staged presentation: instead of coach marks
 * spotlighting a finished screen, the demo shell assembles itself out of
 * the same paper the intro's lines faded from, one piece per step. The
 * tour reports which scene is current (onStageChange) and the shell
 * mirrors it as a data-stage attribute; everything else -- which elements
 * have arrived, which one carries the light, how each enters -- is CSS
 * (see "Staged orientation" in index.css). Structurally this still pairs
 * the unmodified tour state machine with a static, non-Firestore stand-in
 * for Home, exactly as Home pairs its real content with the tour during a
 * Settings replay.
 */
export function OnboardingOrientation({ onFinish }: OnboardingOrientationProps) {
  const [stage, setStage] = useState<OrientationStage>('welcome')

  return (
    <>
      <DemoShell stage={stage} />
      <OnboardingTour presentation="staged" onStageChange={setStage} onFinish={onFinish} />
    </>
  )
}

/** How long after the 'today' scene opens the toggle demonstrates its gesture, and when it puts the mark back. Long enough for the toggle's own entrance to have settled first. */
const DEMO_FLIP_AT_MS = 1600
const DEMO_RETURN_AT_MS = 3000

interface DemoShellProps {
  stage: OrientationStage
}

/**
 * Always inert: unlike Home, where the tour is one optional visitor among
 * several possible screens, this component's only reason to exist is
 * hosting the tour, which is active for its entire lifetime -- there is no
 * "not touring" state that would ever need this interactive.
 *
 * Deliberately generic: the demo ledger is named "Whatever." -- the intro's
 * own line ("It's just a ledger of whatever.") made concrete, stamped the
 * same way the brand stamps its period -- and it holds a real,
 * locally-toggled TodayToggle rather than any fabricated realistic tracked
 * content, per CLAUDE.md's neutrality requirement: nothing here is signed
 * in, so nothing here should read as somebody's actual data. Today's real
 * date is shown as-is; that's calendar fact, not personal content.
 *
 * Every introduced element carries a data-demo name; the current stage
 * (data-stage on the root) decides each one's presence -- not yet arrived,
 * arrived, or carrying the light -- so attention moves by the interface
 * coming alive rather than by a spotlight rectangle. While the 'today'
 * scene has the light, the toggle performs the product's whole gesture
 * once -- the mark slides over on its real spring, rests, and returns --
 * so a first-time user sees the interaction happen instead of reading
 * about it. Skipped under reduced motion, and cancelled (mark restored)
 * the moment the scene moves on.
 */
function DemoShell({ stage }: DemoShellProps) {
  const [state, setState] = useState<DayState>('didnt')
  const todayKey = getTodayKey(resolveDeviceTimezone())

  useEffect(() => {
    if (stage !== 'today' || prefersReducedMotion()) {
      return
    }
    const flip = window.setTimeout(() => setState('did'), DEMO_FLIP_AT_MS)
    const restore = window.setTimeout(() => setState('didnt'), DEMO_RETURN_AT_MS)
    return () => {
      window.clearTimeout(flip)
      window.clearTimeout(restore)
      setState('didnt')
    }
  }, [stage])

  return (
    <main className="screen home demo-home" data-stage={stage} inert>
      <header className="home-header">
        <p className="brand" data-demo="brand">
          Noted.
        </p>
        <div className="home-header-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Open calendar"
            data-demo="calendar"
          >
            <CalendarIcon />
          </button>
        </div>
      </header>

      <div className="home-main">
        <p className="today-date" data-demo="date">{`Today · ${formatDisplayDate(todayKey)}`}</p>
        <h1 className="tracker-title" data-demo="title">
          <button
            type="button"
            className="tracker-title-button"
            aria-label="Switch ledger, current: Whatever."
          >
            <span className="tracker-title-name">Whatever.</span>
            {/* The switch affordance is discovered, not labeled: absent until
                the ledger scene, where it stamps in beside the name -- the
                same gesture the intro's period arrives with. */}
            <span className="demo-chevron" data-demo="chevron">
              <ChevronDownIcon />
            </span>
          </button>
        </h1>
        <div className="today" data-demo="toggle">
          <TodayToggle state={state} defaultState="didnt" onSelect={setState} labels={DEFAULT_STATE_LABELS} />
        </div>
      </div>

      {/* No maker mark here, unlike the real Home footer: it belongs to the
          product, not the orientation, and would only add noise to a scene
          whose footer is being introduced. */}
      <footer className="home-footer">
        <div className="home-footer-links">
          <button type="button" className="footer-link" data-demo="settings">
            Settings
          </button>
        </div>
      </footer>
    </main>
  )
}
