import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  type Unsubscribe,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

export type { User }

/** The provider a signed-in user authenticated with -- 'password' or 'google.com', the only two V1 supports. */
export function primaryProviderId(user: User): string {
  return user.providerData?.[0]?.providerId ?? 'password'
}

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
  markGoogleRedirectPending()
  try {
    await signInWithRedirect(auth, new GoogleAuthProvider())
  } catch (err) {
    // The redirect navigation never happened -- the marker would otherwise
    // wrongly persist and be read as a real redirect return on some later,
    // genuinely fresh load. See consumeGoogleRedirectPending.
    clearGoogleRedirectPending()
    throw err
  }
}

const GOOGLE_REDIRECT_PENDING_KEY = 'noted:auth:google-redirect-pending'

/**
 * signInWithRedirect performs a full top-level navigation away from the app
 * and back -- a fresh page load, fresh JS context, no in-memory state
 * survives. sessionStorage does survive it (scoped to the tab, not the
 * origin or page), so it is the one reliable way for the next boot to tell
 * "the user just came back from the Google OAuth redirect" apart from "the
 * user freshly opened or reloaded the app" -- see App's use of
 * consumeGoogleRedirectPending, which needs that distinction so a Google
 * redirect return is never mistaken for a fresh open under
 * VITE_FORCE_ONBOARDING.
 */
function markGoogleRedirectPending(): void {
  try {
    window.sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, '1')
  } catch {
    // Ignored -- worst case, a later forced-onboarding boot treats the
    // redirect return as a fresh open and shows onboarding once more than
    // strictly necessary. Never worth surfacing to the user.
  }
}

function clearGoogleRedirectPending(): void {
  try {
    window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY)
  } catch {
    // Ignored -- see markGoogleRedirectPending.
  }
}

/**
 * Reads and clears the marker in one step -- it must apply to exactly the
 * one boot that is the redirect return, never to any boot after it, or a
 * later genuinely fresh reload/open would wrongly keep skipping forced
 * onboarding for the rest of the tab's session.
 */
export function consumeGoogleRedirectPending(): boolean {
  try {
    const pending = window.sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) === '1'
    window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY)
    return pending
  } catch {
    return false
  }
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

/**
 * Popup, not redirect, unlike signInWithGoogle above: this reauthenticates
 * an already-signed-in session from one button press inside Settings, not
 * the app's main sign-in funnel -- losing the in-memory account-deletion
 * confirmation (and its typed password field, for the other provider) to a
 * full page navigation would be worse than popup's own known downsides
 * (occasionally blocked, less smooth on mobile). The iOS hang that ruled
 * popup out for the main flow (see signInWithGoogle's comment) was traced
 * to authDomain being cross-origin, which is now fixed for popup and
 * redirect alike by vercel.json's /__/auth/* proxy -- so that specific risk
 * no longer favors redirect here.
 */
export async function reauthenticateWithGoogle(): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in.')
  await reauthenticateWithPopup(user, new GoogleAuthProvider())
}

export async function reauthenticateWithPassword(password: string): Promise<void> {
  const user = auth.currentUser
  if (!user?.email) throw new Error('Not signed in with an email account.')
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
}

/**
 * Deletes the signed-in Firebase Auth identity itself. Must only ever be
 * called after every piece of that user's Firestore data is already gone
 * (see data/account.ts's deleteAllUserData) -- once this succeeds, the
 * client is signed out and can no longer pass Firestore's isOwner check to
 * clean anything up.
 */
export async function deleteAuthAccount(): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in.')
  await deleteUser(user)
}
