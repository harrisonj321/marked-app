import { useEffect, useState } from 'react'
import { subscribeTracker } from '../data/tracker'
import type { TrackerConfig } from '../domain/tracker'

export interface TrackerState {
  tracker: TrackerConfig | null
  loading: boolean
  error: string | null
}

const LOADING_STATE: TrackerState = { tracker: null, loading: true, error: null }
const SIGNED_OUT_STATE: TrackerState = { tracker: null, loading: false, error: null }

export function useTracker(uid: string | null): TrackerState {
  const [state, setState] = useState<TrackerState>(uid ? LOADING_STATE : SIGNED_OUT_STATE)

  // Reset to a loading (or signed-out) state synchronously during render
  // when uid changes, rather than via an effect.
  const [trackedUid, setTrackedUid] = useState(uid)
  if (uid !== trackedUid) {
    setTrackedUid(uid)
    setState(uid ? LOADING_STATE : SIGNED_OUT_STATE)
  }

  useEffect(() => {
    if (!uid) {
      return
    }

    return subscribeTracker(
      uid,
      (tracker) => setState({ tracker, loading: false, error: null }),
      () =>
        setState({
          tracker: null,
          loading: false,
          error: 'Could not load your tracker. Try again.',
        }),
    )
  }, [uid])

  return state
}
