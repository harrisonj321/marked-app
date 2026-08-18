import { useState } from 'react'
import { createLedger } from './data/ledger'
import { hasSeenOnboardingIntro, saveOnboardingIntroSeen } from './data/onboarding'
import { getTodayKey, resolveDeviceTimezone } from './domain/date'
import { useAuthUser } from './hooks/useAuthUser'
import { useLedgers } from './hooks/useLedgers'
import { LoadingScreen } from './components/LoadingScreen'
import { OnboardingIntro } from './components/OnboardingTour'
import { SignIn } from './components/SignIn'
import { Setup } from './components/Setup'
import { Home } from './components/Home'

function App() {
  const { user, loading: authLoading, authError } = useAuthUser()
  const uid = user?.uid ?? null
  const { ledgers, activeLedger, loading: ledgersLoading, error, switchLedger } = useLedgers(uid)
  // Lazy initializer (not an effect) so there is no frame where SignIn is
  // visible before the orientation screen is. Read once at mount: whether a
  // visitor completes/skips it later this session is tracked separately
  // below, not by re-reading storage on every render.
  const [introSeen, setIntroSeen] = useState(() => hasSeenOnboardingIntro())

  if (authLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    // Boot order: orientation before sign-in, never the reverse -- see
    // CLAUDE.md's desired new-user sequence. An already-authenticated
    // session always skips straight past this, regardless of introSeen;
    // this branch only ever applies to a signed-out visitor.
    if (!introSeen) {
      return (
        <OnboardingIntro
          onFinish={(status) => {
            saveOnboardingIntroSeen(status)
            setIntroSeen(true)
          }}
        />
      )
    }
    return <SignIn authError={authError} />
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
