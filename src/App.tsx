import { createLedger } from './data/ledger'
import { getTodayKey, resolveDeviceTimezone } from './domain/date'
import { useAuthUser } from './hooks/useAuthUser'
import { useLedgers } from './hooks/useLedgers'
import { LoadingScreen } from './components/LoadingScreen'
import { SignIn } from './components/SignIn'
import { Setup } from './components/Setup'
import { Home } from './components/Home'

function App() {
  const { user, loading: authLoading } = useAuthUser()
  const uid = user?.uid ?? null
  const { ledgers, activeLedger, loading: ledgersLoading, error, switchLedger } = useLedgers(uid)

  if (authLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <SignIn />
  }

  if (ledgersLoading) {
    return <LoadingScreen />
  }

  if (error) {
    return (
      <main className="screen screen-center">
        <p className="brand">Noted.</p>
        <p role="alert" className="message">
          {error}
        </p>
      </main>
    )
  }

  if (!activeLedger) {
    return (
      <Setup
        onComplete={async ({ name, defaultState }) => {
          const timezone = resolveDeviceTimezone()
          await createLedger(user.uid, {
            name,
            defaultState,
            timezone,
            startDate: getTodayKey(timezone),
          })
        }}
      />
    )
  }

  return (
    <Home uid={user.uid} ledgers={ledgers} activeLedger={activeLedger} onSwitchLedger={switchLedger} />
  )
}

export default App
