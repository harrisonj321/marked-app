import { describe, expect, it } from 'vitest'
import { ONBOARDING_VERSION, isOnboardingRecord } from './onboarding'

describe('isOnboardingRecord', () => {
  it('accepts a completed record', () => {
    expect(isOnboardingRecord({ version: ONBOARDING_VERSION, status: 'completed' })).toBe(true)
  })

  it('accepts a skipped record', () => {
    expect(isOnboardingRecord({ version: ONBOARDING_VERSION, status: 'skipped' })).toBe(true)
  })

  it('rejects a missing status', () => {
    expect(isOnboardingRecord({ version: ONBOARDING_VERSION })).toBe(false)
  })

  it('rejects an invalid status value', () => {
    expect(isOnboardingRecord({ version: ONBOARDING_VERSION, status: 'done' })).toBe(false)
  })

  it('rejects a non-numeric version', () => {
    expect(isOnboardingRecord({ version: '1', status: 'completed' })).toBe(false)
  })

  it('rejects null, arrays, and primitives', () => {
    expect(isOnboardingRecord(null)).toBe(false)
    expect(isOnboardingRecord([])).toBe(false)
    expect(isOnboardingRecord('completed')).toBe(false)
    expect(isOnboardingRecord(undefined)).toBe(false)
  })
})
