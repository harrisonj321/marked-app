import { useState } from 'react'
import { hasCompletedOnboarding, saveOnboardingCompletion } from './data/onboarding'
import { consumeGoogleRedirectPending } from './lib/auth'
import { useAuthUser } from './hooks/useAuthUser'
import { useLedgers } from './hooks/useLedgers'
import { LoadingScreen } from './components/LoadingScreen'
import { OnboardingOrientation } from './components/OnboardingOrientation'
import { Home } from './components/Home'

function App() {
  const { user, loading: authLoading, authError } = useAuthUser()
  const uid = user?.uid ?? null
  const { ledgers, activeLedger, loading: ledgersLoading, error, switchLedger } = useLedgers(uid)
  // Lazy initializer (not an effect) so there is no frame where the guest
  // Home state is visible before the orientation is. Read once at mount:
  // whether this visitor finishes it later this session is tracked
  // separately below, not by re-reading storage on every render.
  // VITE_FORCE_ONBOARDING is a temporary escape hatch -- usable in any
  // environment, including Production, while testing the onboarding flow --
  // for repeatedly seeing the full pre-auth orientation without clearing
  // site data: when set, this device's stored completion is ignored on
  // load, so the orientation always starts fresh. It still writes the
  // normal completion record on finish (below), and once set,
  // orientationDone still only flips true within this loaded session -- so
  // completing/skipping never loops back until the next fresh reload/open.
  // Off (the default), behavior is untouched.
  const forceOnboarding = import.meta.env.VITE_FORCE_ONBOARDING === 'true'
  const [orientationDone, setOrientationDone] = useState(() => {
    // signInWithGoogle's redirect is a full navigation away and back -- a
    // fresh page load and fresh mount, indistinguishable from a genuine
    // fresh open by anything kept in memory. consumeGoogleRedirectPending
    // is the one thing that survives it (see lib/auth): when it reports
    // this boot IS that redirect return, it is a continuation of the same
    // sign-in journey the user was already on (already past onboarding, or
    // it would not have reached Home's sign-in state to click Google in
    // the first place) -- never a fresh open, so it must never re-trigger
    // forced onboarding or the user gets bounced back into onboarding
    // instead of finishing sign-in. Always consumed (even with the flag
    // off) so a stale marker never lingers into a later boot where the
    // flag has since been turned on.
    const returningFromGoogleRedirect = consumeGoogleRedirectPending()
    if (!forceOnboarding) {
      return hasCompletedOnboarding()
    }
    return returningFromGoogleRedirect
  })

  if (authLoading) {
    return <LoadingScreen />
  }

  // Boot order: the full onboarding/orientation experience before sign-in --
  // never split across the auth boundary, never reversed. See CLAUDE.md's
  // desired new-user sequence. Ordinarily (forceOnboarding off) an
  // already-authenticated session always skips straight past this,
  // regardless of orientationDone -- restoring an existing session is not a
  // first-time visit. Under forceOnboarding, though, "every fresh load"
  // means every fresh load, including one that restores an authenticated
  // session, so the gate applies to both signed-in and signed-out visitors
  // there.
  if (!orientationDone && (forceOnboarding || !user)) {
    return (
      <OnboardingOrientation
        onFinish={(status) => {
          saveOnboardingCompletion(status)
          setOrientationDone(true)
        }}
      />
    )
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

  // From here on, Home is the one continuously-mounted app shell for every
  // remaining state -- signed out, signed in with no ledgers yet, and the
  // full experience -- see Home's own doc comment. There is no separate
  // sign-in or first-ledger-setup screen to route to.
  return (
    <Home
      user={user}
      authError={authError}
      ledgers={ledgers}
      activeLedger={activeLedger}
      ledgersLoading={ledgersLoading}
      onSwitchLedger={switchLedger}
    />
  )
}

export default App
