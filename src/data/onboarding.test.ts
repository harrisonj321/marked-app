import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasCompletedOnboarding, saveOnboardingCompletion } from './onboarding'

beforeEach(() => {
  window.localStorage.clear()
})

describe('onboarding orientation persistence', () => {
  it('reports incomplete on a fresh device with no records at all', () => {
    expect(hasCompletedOnboarding()).toBe(false)
  })

  it('reports complete once a completed record is saved', () => {
    saveOnboardingCompletion('completed')
    expect(hasCompletedOnboarding()).toBe(true)
  })

  it('also reports complete for a skipped record', () => {
    saveOnboardingCompletion('skipped')
    expect(hasCompletedOnboarding()).toBe(true)
  })

  it('treats any existing legacy per-account record as proof the orientation was already completed, for backward compatibility with accounts from before it ran entirely pre-auth', () => {
    window.localStorage.setItem('marked:onboarding:u1', JSON.stringify({ version: 1, status: 'completed' }))
    expect(hasCompletedOnboarding()).toBe(true)
  })

  it('treats a pre-rename noted:onboarding:device record as proof of completion, for backward compatibility with devices from before the Marked rename', () => {
    window.localStorage.setItem('noted:onboarding:device', JSON.stringify({ version: 1, status: 'completed' }))
    expect(hasCompletedOnboarding()).toBe(true)
  })

  it('treats a pre-rename noted:onboarding:<uid> record as proof of completion, for backward compatibility with accounts from before the Marked rename', () => {
    window.localStorage.setItem('noted:onboarding:u1', JSON.stringify({ version: 1, status: 'completed' }))
    expect(hasCompletedOnboarding()).toBe(true)
  })

  it('treats a corrupted stored value as incomplete', () => {
    window.localStorage.setItem('marked:onboarding:device', 'not json')
    expect(hasCompletedOnboarding()).toBe(false)
  })

  it('treats a validly-parsed but wrong-shaped stored value as incomplete', () => {
    window.localStorage.setItem('marked:onboarding:device', JSON.stringify({ foo: 'bar' }))
    expect(hasCompletedOnboarding()).toBe(false)
  })

  it('does not throw when localStorage access fails, and reports incomplete', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => hasCompletedOnboarding()).not.toThrow()
    expect(hasCompletedOnboarding()).toBe(false)
    expect(() => saveOnboardingCompletion('completed')).not.toThrow()

    vi.restoreAllMocks()
  })
})
