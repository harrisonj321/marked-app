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
 * Runs the tour in its staged presentation: the same spotlight-and-callout
 * targeting the Settings replay uses -- the cutout plus adjacent words are
 * what make "this control -> this explanation" readable at a glance -- but
 * set inside one continuous scene: the demo shell assembles itself out of
 * the same paper the intro's lines faded from, one piece per step, each
 * new subject arriving inside the spotlight. The tour reports which scene
 * is current (onStageChange) and the shell mirrors it as a data-stage
 * attribute; which elements exist yet and how each enters is CSS (see
 * "Staged orientation" in index.css). Structurally this still pairs the
 * unmodified tour state machine with a static, non-Firestore stand-in for
 * Home, exactly as Home pairs its real content with the tour during a
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

/**
 * The two state changes inside the toggle demonstration, in ms from the
 * 'today' scene opening. Both are choreographed against the fingertip
 * indicator's CSS timeline (see @keyframes demo-touch in index.css, which
 * starts at 1300ms and runs 4800ms -- paced with deliberate breathing
 * room: a settle beat before the press, a slow drag, and a long dwell on
 * the far side before the return, rather than a uniformly faster
 * original): the flip lands as the fingertip's slide crosses the track's
 * midpoint (2650ms-3550ms, so 3100ms), so the ink springs across and
 * arrives with it; the restore lands on the fingertip's return tap over
 * the other word (5450ms, the keyframe's 86.46%). If one timeline moves,
 * move the other.
 */
const DEMO_FLIP_AT_MS = 3100
const DEMO_RETURN_AT_MS = 5450

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
 * (data-stage on the root) decides whether it has arrived on the page yet,
 * so the interface still assembles scene by scene -- but focus itself is
 * carried by the tour's spotlight and adjacent callout (the same
 * data-tour-id anchors the replay uses), never by lighting subtlety.
 *
 * While the 'today' scene is spotlit, the toggle demonstrates the
 * product's whole gesture once, with a visible fingertip performing it:
 * the touch point appears over the mark, presses, slides across (the real
 * ink following on its real spring), lifts, then returns and taps the
 * other word to put the mark back -- so a first-time user sees that the
 * control can be slid or tapped, and watches an interaction rather than a
 * control moving by itself. The fingertip is pure CSS choreography (see
 * @keyframes demo-touch); only the two real state changes live here as
 * timers. Skipped entirely under reduced motion -- the scene then reads
 * as a plain, settled control -- and cancelled (mark restored) the moment
 * the scene moves on.
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
          Marked.
        </p>
        <div className="home-header-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Open calendar"
            data-demo="calendar"
            data-tour-id="open-calendar"
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
            data-tour-id="ledger-title"
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
          {/* The stage wrapper matches the toggle's own footprint so the
              fingertip's percentage positions land on the track's two
              halves. The fingertip only exists while the demonstration can
              actually play -- reduced motion gets a plain, settled control
              with nothing waiting to happen. */}
          <div className="demo-toggle-stage">
            <TodayToggle state={state} defaultState="didnt" onSelect={setState} labels={DEFAULT_STATE_LABELS} />
            {stage === 'today' && !prefersReducedMotion() && (
              <span className="demo-touch" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>

      {/* No maker mark here, unlike the real Home footer: it belongs to the
          product, not the orientation, and would only add noise to a scene
          whose footer is being introduced. */}
      <footer className="home-footer">
        <div className="home-footer-links">
          <button type="button" className="footer-link" data-demo="settings" data-tour-id="open-settings">
            Settings
          </button>
        </div>
      </footer>
    </main>
  )
}
