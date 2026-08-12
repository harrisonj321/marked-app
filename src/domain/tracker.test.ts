import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STATE_LABELS,
  STATE_LABEL_MAX_LENGTH,
  TRACKER_NAME_MAX_LENGTH,
  isOverrideNeeded,
  otherDayState,
  resolveEffectiveState,
  resolveStateLabels,
  validateStateLabel,
  validateTrackerName,
} from './tracker'

describe('otherDayState', () => {
  it('returns didnt for did and did for didnt', () => {
    expect(otherDayState('did')).toBe('didnt')
    expect(otherDayState('didnt')).toBe('did')
  })
})

describe('resolveEffectiveState', () => {
  it('resolves to the default "did" when there is no override', () => {
    expect(resolveEffectiveState('did', null)).toBe('did')
  })

  it('resolves to the default "didnt" when there is no override', () => {
    expect(resolveEffectiveState('didnt', null)).toBe('didnt')
  })

  it('resolves to the override when one is set', () => {
    expect(resolveEffectiveState('did', 'didnt')).toBe('didnt')
    expect(resolveEffectiveState('didnt', 'did')).toBe('did')
  })
})

describe('isOverrideNeeded', () => {
  it('is false when the desired state matches the default', () => {
    expect(isOverrideNeeded('did', 'did')).toBe(false)
    expect(isOverrideNeeded('didnt', 'didnt')).toBe(false)
  })

  it('is true when the desired state differs from the default', () => {
    expect(isOverrideNeeded('did', 'didnt')).toBe(true)
    expect(isOverrideNeeded('didnt', 'did')).toBe(true)
  })
})

describe('validateTrackerName', () => {
  it('trims surrounding whitespace', () => {
    expect(validateTrackerName('  Worked out  ')).toEqual({
      valid: true,
      name: 'Worked out',
    })
  })

  it('rejects an empty name', () => {
    const result = validateTrackerName('')
    expect(result.valid).toBe(false)
  })

  it('rejects a whitespace-only name', () => {
    const result = validateTrackerName('   ')
    expect(result.valid).toBe(false)
  })

  it('rejects a name over the max length', () => {
    const tooLong = 'a'.repeat(TRACKER_NAME_MAX_LENGTH + 1)
    expect(validateTrackerName(tooLong).valid).toBe(false)
  })

  it('accepts a name at exactly the max length', () => {
    const maxLength = 'a'.repeat(TRACKER_NAME_MAX_LENGTH)
    expect(validateTrackerName(maxLength).valid).toBe(true)
  })
})

describe('validateStateLabel', () => {
  it('trims surrounding whitespace', () => {
    expect(validateStateLabel('  Took it  ')).toEqual({
      valid: true,
      label: 'Took it',
    })
  })

  it('rejects an empty label', () => {
    expect(validateStateLabel('').valid).toBe(false)
  })

  it('rejects a whitespace-only label', () => {
    expect(validateStateLabel('   ').valid).toBe(false)
  })

  it('rejects a label over the max length', () => {
    const tooLong = 'a'.repeat(STATE_LABEL_MAX_LENGTH + 1)
    expect(validateStateLabel(tooLong).valid).toBe(false)
  })

  it('accepts a label at exactly the max length', () => {
    const maxLength = 'a'.repeat(STATE_LABEL_MAX_LENGTH)
    expect(validateStateLabel(maxLength).valid).toBe(true)
  })
})

describe('resolveStateLabels', () => {
  it('falls back to the default wording when no labels are stored', () => {
    expect(resolveStateLabels(undefined)).toEqual(DEFAULT_STATE_LABELS)
  })

  it('uses the stored labels when both are set', () => {
    expect(resolveStateLabels({ did: 'Took it', didnt: "Didn't take it" })).toEqual({
      did: 'Took it',
      didnt: "Didn't take it",
    })
  })

  it('falls back per-key when only one label is customized', () => {
    expect(resolveStateLabels({ did: 'Took it' })).toEqual({
      did: 'Took it',
      didnt: DEFAULT_STATE_LABELS.didnt,
    })
  })
})
