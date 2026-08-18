import { useState } from 'react'
import { createLedger } from './data/ledger'
import { hasCompletedOnboarding, saveOnboardingCompletion } from './data/onboarding'
import { getTodayKey, resolveDeviceTimezone } from './domain/date'
import { useAuthUser } from './hooks/useAuthUser'
import { useLedgers } from './hooks/useLedgers'
import { LoadingScreen } from './components/LoadingScreen'
import { OnboardingOrientation } from './components/OnboardingOrientation'
import { SignIn } from './components/SignIn'
import { Setup } from './components/Setup'
import { Home } from './components/Home'

function App() {
  const { user, loading: authLoading, authError } = useAuthUser()
  const uid = user?.uid ?? null
  const { ledgers, activeLedger, loading: ledgersLoading, error, switchLedger } = useLedgers(uid)
  // Lazy initializer (not an effect) so there is no frame where SignIn is
  // visible before the orientation is. Read once at mount: whether this
  // visitor finishes it later this session is tracked separately below, not
  // by re-reading storage on every render.
  const [orientationDone, setOrientationDone] = useState(() => hasCompletedOnboarding())

  if (authLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    // Boot order: the full onboarding/orientation experience before sign-in
    // -- never split across the auth boundary, never reversed. See
    // CLAUDE.md's desired new-user sequence. An already-authenticated
    // session always skips straight past this, regardless of
    // orientationDone; this branch only ever applies to a signed-out
    // visitor.
    if (!orientationDone) {
      return (
        <OnboardingOrientation
          onFinish={(status) => {
            saveOnboardingCompletion(status)
            setOrientationDone(true)
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
