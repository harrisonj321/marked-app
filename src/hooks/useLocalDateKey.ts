import { useEffect, useState } from 'react'
import { getTodayKey, millisecondsUntilNextLocalMidnight } from '../domain/date'

const MIN_TIMEOUT_MS = 1_000

export function useLocalDateKey(timeZone: string | null): string {
  const [dateKey, setDateKey] = useState(() => (timeZone ? getTodayKey(timeZone) : ''))

  // Recompute synchronously during render when the timezone itself changes,
  // rather than via an effect.
  const [trackedTimeZone, setTrackedTimeZone] = useState(timeZone)
  if (timeZone !== trackedTimeZone) {
    setTrackedTimeZone(timeZone)
    setDateKey(timeZone ? getTodayKey(timeZone) : '')
  }

  useEffect(() => {
    if (!timeZone) {
      return
    }

    let timeoutId: ReturnType<typeof setTimeout>

    const scheduleNext = () => {
      const delay = Math.max(
        MIN_TIMEOUT_MS,
        millisecondsUntilNextLocalMidnight(new Date(), timeZone),
      )
      timeoutId = setTimeout(() => {
        setDateKey(getTodayKey(timeZone))
        scheduleNext()
      }, delay)
    }

    // Timers can be throttled or suspended while the tab/app is hidden or
    // the device sleeps, so reconcile immediately whenever it becomes
    // active again instead of trusting the scheduled timeout alone.
    const reconcile = () => {
      if (document.visibilityState === 'visible') {
        setDateKey(getTodayKey(timeZone))
      }
    }

    scheduleNext()
    document.addEventListener('visibilitychange', reconcile)
    window.addEventListener('focus', reconcile)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', reconcile)
      window.removeEventListener('focus', reconcile)
    }
  }, [timeZone])

  return dateKey
}
