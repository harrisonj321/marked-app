import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  type Unsubscribe,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

export type { User }

export function subscribeAuthUser(onChange: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, onChange)
}

/**
 * Redirect, not popup: this SDK's popup AND redirect flows both rely on the
 * same cross-origin iframe (authDomain + "/__/auth/iframe") to relay the
 * sign-in result back to this page, proactively opened specifically on
 * iOS/mobile/Safari -- confirmed by reading the installed
 * @firebase/auth package's BrowserPopupRedirectResolver, not assumed. With
 * the old cross-origin authDomain (noted-app-c7d53.firebaseapp.com vs. the
 * real the-noted-app.vercel.app), that relay crossed origins on WebKit --
 * the engine every iOS browser is required to use, Firefox for iOS
 * included -- which is well known for restricting exactly this kind of
 * cross-origin storage/messaging. That is a plausible explanation for this
 * app's intermittent iOS hang (see CLAUDE.md's splash-screen requirement),
 * not a proven one -- nothing here confirms it was the specific failure.
 * What IS solid either way: making authDomain same-origin (see
 * vercel.json's /__/auth/* proxy) is Firebase's own documented fix for a
 * non-Firebase-Hosting frontend, and redirect over popup is Firebase's own
 * recommendation for mobile ("popups are occasionally blocked... less
 * smooth for mobile users").
 */
export async function signInWithGoogle(): Promise<void> {
  await signInWithRedirect(auth, new GoogleAuthProvider())
}

/**
 * Resolves (or surfaces the error from) a Google sign-in that just
 * completed via redirect. Called once at boot -- see useAuthUser -- where
 * it resolves to nothing on every ordinary page load that isn't returning
 * from a redirect.
 */
export async function resolveGoogleRedirect(): Promise<void> {
  await getRedirectResult(auth)
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password)
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, email, password)
}

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}
