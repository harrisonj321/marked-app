import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { DayState, TrackerConfig } from '../domain/tracker'
import { pinImplicitDayStates } from './day'

function trackerRef(uid: string) {
  return doc(db, 'users', uid, 'tracker', 'config')
}

export interface NewTracker {
  name: string
  defaultState: DayState
  timezone: string
  startDate: string
}

export async function createTracker(uid: string, input: NewTracker): Promise<void> {
  await setDoc(trackerRef(uid), {
    name: input.name,
    defaultState: input.defaultState,
    timezone: input.timezone,
    startDate: input.startDate,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateTrackerName(uid: string, name: string): Promise<void> {
  await updateDoc(trackerRef(uid), {
    name,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Changes what an untouched day counts as.
 *
 * Every day that already has a document keeps the state it currently
 * shows: those states are pinned onto their documents first, so a day
 * recorded as "Did 3x" still reads that way afterwards rather than
 * silently re-resolving (and losing its count) under the new default.
 * Days with no document were never marked, and those follow the new
 * default going forward and backward alike.
 *
 * Pinning runs before the config write, so an interrupted change leaves
 * the tracker on its existing default with some states made explicit --
 * a no-op in meaning, and safe to retry.
 */
export async function updateTrackerDefaultState(
  uid: string,
  currentDefaultState: DayState,
  nextDefaultState: DayState,
): Promise<void> {
  if (currentDefaultState === nextDefaultState) {
    return
  }

  await pinImplicitDayStates(uid, currentDefaultState)
  await updateDoc(trackerRef(uid), {
    defaultState: nextDefaultState,
    updatedAt: serverTimestamp(),
  })
}

export function subscribeTracker(
  uid: string,
  onChange: (tracker: TrackerConfig | null) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    trackerRef(uid),
    (snapshot) => {
      onChange(snapshot.exists() ? toTrackerConfig(snapshot.data()) : null)
    },
    onError,
  )
}

function toTrackerConfig(data: Record<string, unknown>): TrackerConfig {
  return {
    name: data.name as string,
    defaultState: data.defaultState as DayState,
    timezone: data.timezone as string,
    startDate: data.startDate as string,
  }
}
