import { useEffect, useState } from 'react'
import { subscribeMonth, type MonthRecords } from '../data/day'

export interface RangeRecordsState {
  records: MonthRecords
  loading: boolean
  error: string | null
}

const EMPTY_RECORDS: MonthRecords = new Map()
const LOADING_STATE: RangeRecordsState = { records: EMPTY_RECORDS, loading: true, error: null }
const NO_USER_STATE: RangeRecordsState = { records: EMPTY_RECORDS, loading: false, error: null }

/**
 * Live records for an arbitrary inclusive date-key range, scoped to one
 * ledger. The range need not be a single calendar month -- the rolling
 * calendar widens it as more history loads.
 */
export function useRangeRecords(
  uid: string | null,
  ledgerId: string | null,
  startKey: string,
  endKey: string,
): RangeRecordsState {
  const [state, setState] = useState<RangeRecordsState>(uid ? LOADING_STATE : NO_USER_STATE)

  // Reset synchronously during render when the range (or user, or ledger)
  // changes, rather than via an effect.
  const subscriptionKey = `${uid ?? ''}|${ledgerId ?? ''}|${startKey}|${endKey}`
  const [trackedKey, setTrackedKey] = useState(subscriptionKey)
  if (subscriptionKey !== trackedKey) {
    setTrackedKey(subscriptionKey)
    setState(uid ? LOADING_STATE : NO_USER_STATE)
  }

  useEffect(() => {
    if (!uid || !ledgerId) {
      return
    }

    return subscribeMonth(
      uid,
      ledgerId,
      startKey,
      endKey,
      (records) => setState({ records, loading: false, error: null }),
      () =>
        setState({
          records: EMPTY_RECORDS,
          loading: false,
          error: 'Could not load your history. Try again.',
        }),
    )
  }, [uid, ledgerId, startKey, endKey])

  return state
}
