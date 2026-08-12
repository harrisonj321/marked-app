import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasCompletedOnboarding, loadOnboardingRecord, saveOnboardingRecord } from './onboarding'

beforeEach(() => {
  window.localStorage.clear()
})

describe('onboarding persistence', () => {
  it('reports no record for a user who has never seen the tour', () => {
    expect(loadOnboardingRecord('u1')).toBeNull()
    expect(hasCompletedOnboarding('u1')).toBe(false)
  })

  it('round-trips a completed record', () => {
    saveOnboardingRecord('u1', 'completed')

    expect(loadOnboardingRecord('u1')).toEqual({ version: 1, status: 'completed' })
    expect(hasCompletedOnboarding('u1')).toBe(true)
  })

  it('round-trips a skipped record', () => {
    saveOnboardingRecord('u1', 'skipped')

    expect(loadOnboardingRecord('u1')).toEqual({ version: 1, status: 'skipped' })
    expect(hasCompletedOnboarding('u1')).toBe(true)
  })

  it('keeps records isolated per uid', () => {
    saveOnboardingRecord('u1', 'completed')

    expect(hasCompletedOnboarding('u2')).toBe(false)
  })

  it('treats a corrupted stored value as no record', () => {
    window.localStorage.setItem('noted:onboarding:u1', 'not json')

    expect(loadOnboardingRecord('u1')).toBeNull()
  })

  it('treats a validly-parsed but wrong-shaped stored value as no record', () => {
    window.localStorage.setItem('noted:onboarding:u1', JSON.stringify({ foo: 'bar' }))

    expect(loadOnboardingRecord('u1')).toBeNull()
  })

  it('does not throw when localStorage access fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => saveOnboardingRecord('u1', 'completed')).not.toThrow()
    expect(() => loadOnboardingRecord('u1')).not.toThrow()
    expect(loadOnboardingRecord('u1')).toBeNull()

    vi.restoreAllMocks()
  })
})
