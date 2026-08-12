import { useEffect, useState } from 'react'

/** Chromium-only event; not yet part of the standard DOM lib types. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallPromptOutcome = 'accepted' | 'dismissed' | 'unavailable'

export interface InstallPromptState {
  /** Whether the browser has offered a native install prompt this page load. */
  canPromptInstall: boolean
  promptInstall: () => Promise<InstallPromptOutcome>
}

/**
 * Chrome/Edge fire `beforeinstallprompt` as soon as install eligibility is
 * met, which can happen well before onboarding's install step is ever
 * reached (or before onboarding runs at all). Calling preventDefault and
 * holding onto the event is the only way to trigger it later from our own
 * UI instead of the browser's default install affordance -- the event
 * cannot be re-requested once missed, so this hook is mounted for the
 * lifetime of the app (from App's top level) rather than only while the
 * tour is on screen.
 */
export function useInstallPrompt(): InstallPromptState {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredEvent(event as BeforeInstallPromptEvent)
    }

    function handleInstalled() {
      setDeferredEvent(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function promptInstall(): Promise<InstallPromptOutcome> {
    if (!deferredEvent) {
      return 'unavailable'
    }
    await deferredEvent.prompt()
    const { outcome } = await deferredEvent.userChoice
    setDeferredEvent(null)
    return outcome
  }

  return { canPromptInstall: deferredEvent !== null, promptInstall }
}
