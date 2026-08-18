import {
  ONBOARDING_VERSION,
  isOnboardingRecord,
  type OnboardingRecord,
  type OnboardingStatus,
} from '../domain/onboarding'

/**
 * Onboarding is device-local UI state, not tracked personal-log data, so it
 * lives in localStorage rather than Firestore -- that keeps it off the
 * synced record entirely and avoids a Firestore Rules change for a
 * client-only concern.
 *
 * The full onboarding/orientation experience (welcome + coach marks +
 * optional install step) runs entirely before authentication -- see App's
 * OnboardingOrientation -- so there is no account yet to key this by. One
 * fixed, device-scoped key covers every visitor to this device/browser.
 */
const STORAGE_KEY = 'noted:onboarding:device'

/**
 * Whether this device has already completed or skipped the full
 * onboarding/orientation experience. Also true if this device holds a
 * *legacy* per-account record (keys of the form `noted:onboarding:<uid>`,
 * from before the orientation ran entirely pre-auth) -- an account that
 * already sat through the full experience once under the old architecture
 * must not be made to redo it just because the storage model changed
 * underneath it.
 */
export function hasCompletedOnboarding(): boolean {
  try {
    if (isOnboardingRecord(parseStoredRecord(window.localStorage.getItem(STORAGE_KEY)))) {
      return true
    }
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (
        key &&
        key !== STORAGE_KEY &&
        key.startsWith('noted:onboarding:') &&
        isOnboardingRecord(parseStoredRecord(window.localStorage.getItem(key)))
      ) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

/** Failure here (quota, private-browsing writes) just means the orientation may show again later -- never worth surfacing to the user. */
export function saveOnboardingCompletion(status: OnboardingStatus): void {
  try {
    const record: OnboardingRecord = { version: ONBOARDING_VERSION, status }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Ignored -- see above.
  }
}

function parseStoredRecord(raw: string | null): unknown {
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
