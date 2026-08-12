import { useState } from 'react'
import {
  updateTrackerDefaultState,
  updateTrackerName,
  updateTrackerStateLabels,
} from '../data/tracker'
import { signOutUser } from '../lib/auth'
import { formatDisplayDate } from '../domain/date'
import { useLocalDateKey } from '../hooks/useLocalDateKey'
import { resolveStateLabels, type DayState, type StateLabels, type TrackerConfig } from '../domain/tracker'
import { CalendarSheet } from './CalendarSheet'
import { SettingsSheet } from './SettingsSheet'
import { TodaySection } from './TodaySection'
import { TrackerNameEditor } from './TrackerNameEditor'
import { CalendarIcon } from './icons'

interface HomeProps {
  uid: string
  tracker: TrackerConfig
}

export function Home({ uid, tracker }: HomeProps) {
  const todayKey = useLocalDateKey(tracker.timezone)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const labels = resolveStateLabels(tracker.stateLabels)

  async function handleNameSave(name: string) {
    await updateTrackerName(uid, name)
  }

  async function handleDefaultStateSave(defaultState: DayState) {
    await updateTrackerDefaultState(uid, tracker.defaultState, defaultState)
  }

  async function handleStateLabelsSave(stateLabels: StateLabels) {
    await updateTrackerStateLabels(uid, stateLabels)
  }

  return (
    <main className="screen home">
      <header className="home-header">
        <p className="brand">Noted.</p>
        <button
          type="button"
          className="icon-button"
          aria-label="Open calendar"
          onClick={() => setCalendarOpen(true)}
        >
          <CalendarIcon />
        </button>
      </header>

      <div className="home-main">
        {todayKey && <p className="today-date">{`Today · ${formatDisplayDate(todayKey)}`}</p>}
        <TrackerNameEditor name={tracker.name} onSave={handleNameSave} />
        <TodaySection
          uid={uid}
          defaultState={tracker.defaultState}
          timezone={tracker.timezone}
          labels={labels}
        />
      </div>

      <footer className="home-footer">
        <div className="home-footer-links">
          <button type="button" className="footer-link" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
          <button type="button" className="footer-link" onClick={() => void signOutUser()}>
            Sign out
          </button>
        </div>
        <p className="maker-mark">{`Made with ❤️ by Maker 428 · v${__APP_VERSION__}`}</p>
      </footer>

      {calendarOpen && todayKey && (
        <CalendarSheet
          uid={uid}
          tracker={tracker}
          todayKey={todayKey}
          onDismiss={() => setCalendarOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          defaultState={tracker.defaultState}
          stateLabels={labels}
          onSaveDefaultState={handleDefaultStateSave}
          onSaveStateLabels={handleStateLabelsSave}
          onDismiss={() => setSettingsOpen(false)}
        />
      )}
    </main>
  )
}
