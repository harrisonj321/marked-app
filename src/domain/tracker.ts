export type DayState = 'did' | 'didnt'

export interface TrackerConfig {
  name: string
  defaultState: DayState
  timezone: string
  startDate: string
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

export function resolveEffectiveState(
  defaultState: DayState,
  override: DayState | null,
): DayState {
  return override ?? defaultState
}

export function isOverrideNeeded(defaultState: DayState, desiredState: DayState): boolean {
  return desiredState !== defaultState
}

export function oppositeState(state: DayState): DayState {
  return state === 'did' ? 'didnt' : 'did'
}
