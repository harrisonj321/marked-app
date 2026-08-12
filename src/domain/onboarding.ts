/**
 * Bumped only if a future redesign of the tour itself needs to tell old
 * completion records apart from new ones. Existing users who completed an
 * earlier version must not be forced back through onboarding just because
 * this changes -- see CLAUDE.md's existing-user handling. Nothing currently
 * reads this to decide whether to re-show the tour.
 */
export const ONBOARDING_VERSION = 1

export type OnboardingStatus = 'completed' | 'skipped'

export interface OnboardingRecord {
  version: number
  status: OnboardingStatus
}

function isOnboardingStatus(value: unknown): value is OnboardingStatus {
  return value === 'completed' || value === 'skipped'
}

/** Narrows arbitrary parsed JSON to a well-formed record; anything else is treated as absent. */
export function isOnboardingRecord(value: unknown): value is OnboardingRecord {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return typeof candidate.version === 'number' && isOnboardingStatus(candidate.status)
}
