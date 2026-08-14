import { useEffect, useState } from 'react'
import { normalizeDailyRecord, type DailyRecord } from '../domain/day'
import { resolveEffectiveState, type DayState } from '../domain/tracker'
import { saveDailyRecord, subscribeDay } from '../data/day'
import { useLocalDateKey } from './useLocalDateKey'

export interface TodayState {
  dateKey: string
  effectiveState: DayState | null
  record: DailyRecord
  pending: boolean
  error: string | null
  setState: (desired: DayState) => void
}

const EMPTY_RECORD: DailyRecord = {}

export function useTodayState(
  uid: string | null,
  ledgerId: string | null,
  defaultState: DayState | null,
  timezone: string | null,
): TodayState {
  const dateKey = useLocalDateKey(timezone)
  const [record, setRecord] = useState<DailyRecord | undefined>(undefined)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset per-day state synchronously during render when the subscription
  // key (who/which ledger/which day -- including after a local midnight
  // rollover, or switching ledgers) changes, rather than via an effect.
  const subscriptionKey = `${uid ?? ''}|${ledgerId ?? ''}|${dateKey}`
  const [trackedKey, setTrackedKey] = useState(subscriptionKey)
  if (subscriptionKey !== trackedKey) {
    setTrackedKey(subscriptionKey)
    setRecord(undefined)
    setPending(false)
    setError(null)
  }

  useEffect(() => {
    if (!uid || !ledgerId || !dateKey) {
      return
    }

    return subscribeDay(
      uid,
      ledgerId,
      dateKey,
      (snapshot) => {
        setRecord(snapshot.record)
        setPending(snapshot.hasPendingWrites)
      },
      () => setError('Could not load today. Try again.'),
    )
  }, [uid, ledgerId, dateKey])

  const effectiveState =
    defaultState && record !== undefined
      ? resolveEffectiveState(defaultState, record.state ?? null)
      : null

  function setState(desired: DayState) {
    if (!uid || !ledgerId || !dateKey || !defaultState || effectiveState === null || record === undefined) {
      return
    }
    if (desired === effectiveState) {
      return
    }

    setError(null)

    const normalized = normalizeDailyRecord({
      defaultState,
      effectiveState: desired,
      note: record.note,
      count: record.count,
    })

    saveDailyRecord(uid, ledgerId, dateKey, normalized).catch(() =>
      setError('Could not save. Try again.'),
    )
  }

  return {
    dateKey,
    effectiveState,
    record: record ?? EMPTY_RECORD,
    pending,
    error,
    setState,
  }
}
