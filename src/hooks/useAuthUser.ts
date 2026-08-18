import { useEffect, useState } from 'react'
import { resolveGoogleRedirect, subscribeAuthUser, type User } from '../lib/auth'
import { describeAuthError } from '../lib/authErrors'

export interface AuthUserState {
  user: User | null
  loading: boolean
  /** Set only when a Google redirect just completed and failed -- see SignIn. */
  authError: string | null
}

/**
 * `loading` clears purely from onAuthStateChanged's first callback, which
 * Firebase guarantees fires exactly once auth state is known -- including
 * the outcome of any redirect sign-in that just completed -- regardless of
 * whether resolveGoogleRedirect below succeeds, rejects, or (the common
 * case) never applies. That is what keeps boot deterministic: no redirect
 * result, redirect error, existing session, missing session, or network
 * hiccup can leave the app stuck on its loading screen. See CLAUDE.md's
 * splash-screen requirement -- this must never be "fixed" with a timeout.
 */
export function useAuthUser(): AuthUserState {
  const [state, setState] = useState<AuthUserState>({ user: null, loading: true, authError: null })

  useEffect(() => {
    let cancelled = false

    resolveGoogleRedirect().catch((err: unknown) => {
      if (!cancelled) {
        setState((prev) => ({ ...prev, authError: describeAuthError(err) }))
      }
    })

    const unsubscribe = subscribeAuthUser((user) => {
      if (!cancelled) {
        setState((prev) => ({ ...prev, user, loading: false }))
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return state
}
