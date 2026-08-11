import { updateTrackerName } from '../data/tracker'
import { signOutUser } from '../lib/auth'
import { useLocalDateKey } from '../hooks/useLocalDateKey'
import type { TrackerConfig } from '../domain/tracker'
import { Calendar } from './Calendar'
import { TodaySection } from './TodaySection'
import { TrackerNameEditor } from './TrackerNameEditor'

interface HomeProps {
  uid: string
  tracker: TrackerConfig
}

export function Home({ uid, tracker }: HomeProps) {
  const todayKey = useLocalDateKey(tracker.timezone)

  async function handleNameSave(name: string) {
    await updateTrackerName(uid, name)
  }

  return (
    <main className="screen">
      <header className="home-header">
        <p className="brand">Noted.</p>
        <TrackerNameEditor name={tracker.name} onSave={handleNameSave} />
      </header>

      <TodaySection uid={uid} defaultState={tracker.defaultState} timezone={tracker.timezone} />

      {todayKey && <Calendar uid={uid} tracker={tracker} todayKey={todayKey} />}

      <button type="button" onClick={() => void signOutUser()} className="sign-out">
        Sign out
      </button>
    </main>
  )
}
