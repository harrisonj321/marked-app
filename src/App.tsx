import { createTracker } from './data/tracker'
import { getTodayKey } from './domain/date'
import { useAuthUser } from './hooks/useAuthUser'
import { useTracker } from './hooks/useTracker'
import { LoadingScreen } from './components/LoadingScreen'
import { SignIn } from './components/SignIn'
import { Setup } from './components/Setup'
import { Home } from './components/Home'

function resolveTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function App() {
  const { user, loading: authLoading } = useAuthUser()
  const uid = user?.uid ?? null
  const { tracker, loading: trackerLoading, error: trackerError } = useTracker(uid)

  if (authLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <SignIn />
  }

  if (trackerLoading) {
    return <LoadingScreen />
  }

  if (trackerError) {
    return (
      <main className="screen screen-center">
        <p className="brand">Noted.</p>
        <p role="alert" className="message">
          {trackerError}
        </p>
      </main>
    )
  }

  if (!tracker) {
    return (
      <Setup
        onComplete={async ({ name, defaultState }) => {
          const timezone = resolveTimezone()
          await createTracker(user.uid, {
            name,
            defaultState,
            timezone,
            startDate: getTodayKey(timezone),
          })
        }}
      />
    )
  }

  return <Home uid={user.uid} tracker={tracker} />
}

export default App
