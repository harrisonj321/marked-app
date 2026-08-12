import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useInstallPrompt } from './useInstallPrompt'

function dispatchBeforeInstallPrompt(overrides: Partial<{ prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }> = {}) {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  event.prompt = overrides.prompt ?? vi.fn().mockResolvedValue(undefined)
  event.userChoice = overrides.userChoice ?? Promise.resolve({ outcome: 'accepted' })
  window.dispatchEvent(event)
  return event
}

describe('useInstallPrompt', () => {
  it('starts with no install prompt available', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canPromptInstall).toBe(false)
  })

  it('becomes available once the browser offers beforeinstallprompt', () => {
    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      dispatchBeforeInstallPrompt()
    })

    expect(result.current.canPromptInstall).toBe(true)
  })

  it('prevents the default browser install UI so it can be shown from our own UI later', () => {
    renderHook(() => useInstallPrompt())
    let event!: Event

    act(() => {
      event = dispatchBeforeInstallPrompt()
    })

    expect(event.defaultPrevented).toBe(true)
  })

  it('promptInstall triggers the captured event and reports the outcome', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      dispatchBeforeInstallPrompt({ prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) })
    })

    let outcome: string | undefined
    await act(async () => {
      outcome = await result.current.promptInstall()
    })

    expect(prompt).toHaveBeenCalled()
    expect(outcome).toBe('accepted')
  })

  it('promptInstall resolves to unavailable when no prompt was ever captured', async () => {
    const { result } = renderHook(() => useInstallPrompt())

    const outcome = await result.current.promptInstall()

    expect(outcome).toBe('unavailable')
  })

  it('clears availability once the prompt has been used', async () => {
    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      dispatchBeforeInstallPrompt()
    })
    expect(result.current.canPromptInstall).toBe(true)

    await act(async () => {
      await result.current.promptInstall()
    })

    expect(result.current.canPromptInstall).toBe(false)
  })

  it('clears availability when the app is installed through another path', () => {
    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      dispatchBeforeInstallPrompt()
    })
    expect(result.current.canPromptInstall).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    expect(result.current.canPromptInstall).toBe(false)
  })
})
