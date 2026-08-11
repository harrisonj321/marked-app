import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1_000

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) {
        return
      }

      // A long-lived PWA rarely re-navigates, so the browser's on-navigation
      // update check may never run again. Re-check when the app regains
      // visibility and hourly while it stays open. The browser deduplicates
      // and throttles these checks; a prompt appears only when a new service
      // worker is genuinely waiting.
      const check = () => {
        if (document.visibilityState === 'visible') {
          void registration.update()
        }
      }
      document.addEventListener('visibilitychange', check)
      setInterval(check, UPDATE_CHECK_INTERVAL_MS)
    },
  })

  if (!needRefresh) {
    return null
  }

  return (
    <div className="update-banner" role="status">
      <p className="update-banner-message">An update is ready.</p>
      <button
        type="button"
        className="update-banner-reload"
        onClick={() => void updateServiceWorker(true)}
      >
        Reload
      </button>
      <button
        type="button"
        className="update-banner-dismiss"
        onClick={() => setNeedRefresh(false)}
      >
        Dismiss
      </button>
    </div>
  )
}
