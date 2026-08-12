import {
  ONBOARDING_VERSION,
  isOnboardingRecord,
  type OnboardingRecord,
  type OnboardingStatus,
} from '../domain/onboarding'

/**
 * Onboarding is device-local UI state, not tracked personal-log data, so it
 * lives in localStorage rather than the Firestore tracker document -- that
 * keeps it off the synced record entirely and avoids a Firestore Rules
 * change for a client-only concern. Keyed per-uid so a shared device signed
 * into a different Google account never inherits another account's tour
 * completion (or, on sign-out/sign-in as the same user, loses it).
 */
function storageKey(uid: string): string {
  return `noted:onboarding:${uid}`
}

/** Reads are defensive: private-browsing storage restrictions or a corrupted value both just mean "not completed." */
export function loadOnboardingRecord(uid: string): OnboardingRecord | null {
  try {
    const raw = window.localStorage.getItem(storageKey(uid))
    if (!raw) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    return isOnboardingRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function hasCompletedOnboarding(uid: string): boolean {
  return loadOnboardingRecord(uid) !== null
}

/** Failure here (quota, private-browsing writes) just means the tour may show again later -- never worth surfacing to the user. */
export function saveOnboardingRecord(uid: string, status: OnboardingStatus): void {
  try {
    const record: OnboardingRecord = { version: ONBOARDING_VERSION, status }
    window.localStorage.setItem(storageKey(uid), JSON.stringify(record))
  } catch {
    // Ignored -- see above.
  }
}
