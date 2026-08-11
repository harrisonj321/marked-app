import { useEffect, useState } from 'react'
import {
  isOverrideNeeded,
  oppositeState,
  resolveEffectiveState,
  type DayState,
} from '../domain/tracker'
import { clearDayOverride, setDayOverride, subscribeDay } from '../data/day'
import { useLocalDateKey } from './useLocalDateKey'

export interface TodayState {
  dateKey: string
  effectiveState: DayState | null
  pending: boolean
  error: string | null
  toggle: () => void
}

export function useTodayState(
  uid: string | null,
  defaultState: DayState | null,
  timezone: string | null,
): TodayState {
  const dateKey = useLocalDateKey(timezone)
  const [override, setOverride] = useState<DayState | null | undefined>(undefined)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset per-day state synchronously during render when the subscription
  // key (who/which day -- including after a local midnight rollover)
  // changes, rather than via an effect.
  const subscriptionKey = `${uid ?? ''}|${dateKey}`
  const [trackedKey, setTrackedKey] = useState(subscriptionKey)
  if (subscriptionKey !== trackedKey) {
    setTrackedKey(subscriptionKey)
    setOverride(undefined)
    setPending(false)
    setError(null)
  }

  useEffect(() => {
    if (!uid || !dateKey) {
      return
    }

    return subscribeDay(
      uid,
      dateKey,
      (snapshot) => {
        setOverride(snapshot.state)
        setPending(snapshot.hasPendingWrites)
      },
      () => setError('Could not load today. Try again.'),
    )
  }, [uid, dateKey])

  const effectiveState =
    defaultState && override !== undefined ? resolveEffectiveState(defaultState, override) : null

  function toggle() {
    if (!uid || !dateKey || !defaultState || effectiveState === null) {
      return
    }

    const desired = oppositeState(effectiveState)
    setError(null)

    const action = isOverrideNeeded(defaultState, desired)
      ? setDayOverride(uid, dateKey, desired)
      : clearDayOverride(uid, dateKey)

    action.catch(() => setError('Could not save. Try again.'))
  }

  return { dateKey, effectiveState, pending, error, toggle }
}
