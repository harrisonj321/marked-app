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
