export type DayState = 'did' | 'didnt'

export interface StateLabels {
  did: string
  didnt: string
}

export interface TrackerConfig {
  name: string
  defaultState: DayState
  timezone: string
  startDate: string
  stateLabels?: StateLabels
}

export const TRACKER_NAME_MAX_LENGTH = 60

export type TrackerNameValidation =
  | { valid: true; name: string }
  | { valid: false; error: string }

export function validateTrackerName(input: string): TrackerNameValidation {
  const name = input.trim()

  if (name.length === 0) {
    return { valid: false, error: 'Enter a name.' }
  }

  if (name.length > TRACKER_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Keep it under ${TRACKER_NAME_MAX_LENGTH} characters.`,
    }
  }

  return { valid: true, name }
}

/**
 * The wording shown throughout the app before a user customizes it. These
 * are presentation-only: renaming a label never changes which underlying
 * DayState ('did' | 'didnt') a day resolves to or how it is stored.
 */
export const DEFAULT_STATE_LABELS: StateLabels = { did: 'Did', didnt: "Didn't" }

export const STATE_LABEL_MAX_LENGTH = 24

export type StateLabelValidation =
  | { valid: true; label: string }
  | { valid: false; error: string }

export function validateStateLabel(input: string): StateLabelValidation {
  const label = input.trim()

  if (label.length === 0) {
    return { valid: false, error: 'Enter a label.' }
  }

  if (label.length > STATE_LABEL_MAX_LENGTH) {
    return {
      valid: false,
      error: `Keep it under ${STATE_LABEL_MAX_LENGTH} characters.`,
    }
  }

  return { valid: true, label }
}

/** Falls back to the default wording for a state whose label was never customized. */
export function resolveStateLabels(stateLabels: Partial<StateLabels> | undefined): StateLabels {
  return {
    did: stateLabels?.did || DEFAULT_STATE_LABELS.did,
    didnt: stateLabels?.didnt || DEFAULT_STATE_LABELS.didnt,
  }
}

export function resolveEffectiveState(
  defaultState: DayState,
  override: DayState | null,
): DayState {
  return override ?? defaultState
}

export function isOverrideNeeded(defaultState: DayState, desiredState: DayState): boolean {
  return desiredState !== defaultState
}
