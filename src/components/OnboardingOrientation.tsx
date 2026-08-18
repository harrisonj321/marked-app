import { useState } from 'react'
import { formatDisplayDate, getTodayKey, resolveDeviceTimezone } from '../domain/date'
import type { OnboardingStatus } from '../domain/onboarding'
import { DEFAULT_STATE_LABELS, type DayState } from '../domain/tracker'
import { OnboardingTour } from './OnboardingTour'
import { TodayToggle } from './TodayToggle'
import { CalendarIcon, ChevronDownIcon } from './icons'

interface OnboardingOrientationProps {
  onFinish: (status: OnboardingStatus) => void
}

/**
 * The full first-run tour, always run before any account exists -- see
 * App.tsx and CLAUDE.md's "onboarding/orientation before auth" requirement.
 * OnboardingTour's coach marks anchor to real, currently-rendered controls
 * (see useTourTargetRect), so this pairs the unmodified tour with DemoShell:
 * a static, non-Firestore stand-in for Home carrying the same data-tour-id
 * anchors -- same layout and classNames as the real thing, nothing
 * redesigned here, just no uid, ledger, or account behind it. Structurally
 * this mirrors exactly how Home itself pairs its real content with the tour
 * during a Settings replay.
 */
export function OnboardingOrientation({ onFinish }: OnboardingOrientationProps) {
  return (
    <>
      <DemoShell />
      <OnboardingTour onFinish={onFinish} />
    </>
  )
}

/**
 * Always inert: unlike Home, where the tour is one optional visitor among
 * several possible screens, this component's only reason to exist is
 * hosting the tour, which is active for its entire lifetime -- there is no
 * "not touring" state that would ever need this interactive.
 *
 * Deliberately generic: a placeholder ledger name ("Example") and a
 * locally-toggled TodayToggle rather than any fabricated realistic tracked
 * content, per CLAUDE.md's neutrality requirement -- nothing here is signed
 * in, so nothing here should read as somebody's actual data. Today's real
 * date is shown as-is; that's calendar fact, not personal content.
 */
function DemoShell() {
  const [state, setState] = useState<DayState>('didnt')
  const todayKey = getTodayKey(resolveDeviceTimezone())

  return (
    <main className="screen home" inert>
      <header className="home-header">
        <p className="brand">Noted.</p>
        <div className="home-header-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Open calendar"
            data-tour-id="open-calendar"
          >
            <CalendarIcon />
          </button>
        </div>
      </header>

      <div className="home-main">
        <p className="today-date">{`Today · ${formatDisplayDate(todayKey)}`}</p>
        <h1 className="tracker-title">
          <button
            type="button"
            className="tracker-title-button"
            data-tour-id="ledger-title"
            aria-label="Switch ledger, current: Example"
          >
            <span className="tracker-title-name">Example</span>
            <ChevronDownIcon />
          </button>
        </h1>
        <div className="today">
          <TodayToggle state={state} defaultState="didnt" onSelect={setState} labels={DEFAULT_STATE_LABELS} />
        </div>
      </div>

      <footer className="home-footer">
        <div className="home-footer-links">
          <button type="button" className="footer-link" data-tour-id="open-settings">
            Settings
          </button>
        </div>
        <p className="maker-mark">{`Made with ❤️ by Maker 428 · v${__APP_VERSION__}`}</p>
      </footer>
    </main>
  )
}
