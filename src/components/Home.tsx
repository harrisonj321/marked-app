import { useState } from 'react'
import { updateTrackerName } from '../data/tracker'
import { signOutUser } from '../lib/auth'
import { formatDisplayDate } from '../domain/date'
import { useLocalDateKey } from '../hooks/useLocalDateKey'
import type { TrackerConfig } from '../domain/tracker'
import { CalendarSheet } from './CalendarSheet'
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

  async function handleNameSave(name: string) {
    await updateTrackerName(uid, name)
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
        <TodaySection uid={uid} defaultState={tracker.defaultState} timezone={tracker.timezone} />
      </div>

      <footer className="home-footer">
        <button type="button" onClick={() => void signOutUser()} className="sign-out">
          Sign out
        </button>
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
    </main>
  )
}
