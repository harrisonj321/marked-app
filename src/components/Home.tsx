import { updateTrackerName } from '../data/tracker'
import { signOutUser } from '../lib/auth'
import { formatDisplayDate } from '../domain/date'
import { oppositeState, type TrackerConfig } from '../domain/tracker'
import { useTodayState } from '../hooks/useTodayState'
import { TrackerNameEditor } from './TrackerNameEditor'

interface HomeProps {
  uid: string
  tracker: TrackerConfig
}

const STATE_LABEL = {
  did: 'Did',
  didnt: "Didn't",
} as const

export function Home({ uid, tracker }: HomeProps) {
  const today = useTodayState(uid, tracker.defaultState, tracker.timezone)
  const next = today.effectiveState ? oppositeState(today.effectiveState) : null

  async function handleNameSave(name: string) {
    await updateTrackerName(uid, name)
  }

  return (
    <main className="screen">
      <header className="home-header">
        <p className="brand">Noted.</p>
        <TrackerNameEditor name={tracker.name} onSave={handleNameSave} />
      </header>

      <section className="today">
        <p className="today-date">Today &middot; {formatDisplayDate(today.dateKey)}</p>

        {today.effectiveState && next && (
          <>
            <p className="today-state" aria-live="polite">
              {STATE_LABEL[today.effectiveState]}
            </p>
            <button
              type="button"
              onClick={today.toggle}
              className="toggle"
              aria-label={`Mark today as "${STATE_LABEL[next]}"`}
            >
              {STATE_LABEL[next]}
            </button>
            {today.pending && (
              <p className="message" aria-live="polite">
                Saving&hellip;
              </p>
            )}
            {today.error && (
              <p role="alert" className="message">
                {today.error}
              </p>
            )}
          </>
        )}
      </section>

      <button type="button" onClick={() => void signOutUser()} className="sign-out">
        Sign out
      </button>
    </main>
  )
}
