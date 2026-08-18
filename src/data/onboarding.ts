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

/**
 * The pre-auth orientation screen (see App's OnboardingIntro) has no uid to
 * key off yet, so its own completion lives at this fixed device-scoped key
 * instead of storageKey's per-account one.
 */
const DEVICE_INTRO_STORAGE_KEY = 'noted:onboarding:device'

/**
 * Whether this device has already seen the pre-auth orientation screen.
 * Also true if this device holds ANY per-account onboarding record: those
 * predate the orientation screen being split out of the in-Home tour, so an
 * account that already finished the full tour here has necessarily already
 * seen this same welcome content once -- it must not reappear for them.
 */
export function hasSeenOnboardingIntro(): boolean {
  try {
    if (isOnboardingRecord(parseStoredRecord(window.localStorage.getItem(DEVICE_INTRO_STORAGE_KEY)))) {
      return true
    }
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (
        key &&
        key !== DEVICE_INTRO_STORAGE_KEY &&
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

/** Failure here just means the intro may show again later -- never worth surfacing, see saveOnboardingRecord. */
export function saveOnboardingIntroSeen(status: OnboardingStatus): void {
  try {
    const record: OnboardingRecord = { version: ONBOARDING_VERSION, status }
    window.localStorage.setItem(DEVICE_INTRO_STORAGE_KEY, JSON.stringify(record))
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
