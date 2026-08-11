import { describe, expect, it } from 'vitest'
import {
  TRACKER_NAME_MAX_LENGTH,
  isOverrideNeeded,
  resolveEffectiveState,
  validateTrackerName,
} from './tracker'

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
