import { useEffect, useState } from 'react'
import { monthKeyRange, type YearMonth } from '../domain/calendar'
import { subscribeMonth, type MonthRecords } from '../data/day'

export interface MonthRecordsState {
  records: MonthRecords
  loading: boolean
  error: string | null
}

const EMPTY_RECORDS: MonthRecords = new Map()
const LOADING_STATE: MonthRecordsState = { records: EMPTY_RECORDS, loading: true, error: null }
const NO_USER_STATE: MonthRecordsState = { records: EMPTY_RECORDS, loading: false, error: null }

export function useMonthRecords(uid: string | null, yearMonth: YearMonth): MonthRecordsState {
  const { startKey, endKey } = monthKeyRange(yearMonth)
  const [state, setState] = useState<MonthRecordsState>(uid ? LOADING_STATE : NO_USER_STATE)

  // Reset synchronously during render when the visible month (or user)
  // changes, rather than via an effect.
  const subscriptionKey = `${uid ?? ''}|${startKey}`
  const [trackedKey, setTrackedKey] = useState(subscriptionKey)
  if (subscriptionKey !== trackedKey) {
    setTrackedKey(subscriptionKey)
    setState(uid ? LOADING_STATE : NO_USER_STATE)
  }

  useEffect(() => {
    if (!uid) {
      return
    }

    return subscribeMonth(
      uid,
      startKey,
      endKey,
      (records) => setState({ records, loading: false, error: null }),
      () =>
        setState({
          records: EMPTY_RECORDS,
          loading: false,
          error: 'Could not load this month. Try again.',
        }),
    )
  }, [uid, startKey, endKey])

  return state
}
