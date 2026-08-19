/**
 * Deliberately dependency-free (no `firebase/auth` value imports, no
 * `./firebase`): callers that only need error copy -- including tests --
 * can use this without pulling in a Firebase Auth instance, which requires
 * real project environment variables to construct. See useAuthUser and
 * SignIn for the two call sites.
 */
export function describeAuthError(error: unknown): string {
  switch (authErrorCode(error)) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/email-already-in-use':
      return 'An account already exists for that email. Try Sign in instead.'
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return "Email or password didn't match. If you use Google for this email, continue with Google instead."
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'auth/user-disabled':
      return 'This account has been disabled.'
    case 'auth/requires-recent-login':
      return 'Please confirm your sign-in again to continue.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups and try again.'
    default:
      return 'Sign-in did not complete. Try again.'
  }
}

function authErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : ''
}
