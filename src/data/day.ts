import {
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { DayState } from '../domain/tracker'

function dayRef(uid: string, dateKey: string) {
  return doc(db, 'users', uid, 'days', dateKey)
}

export interface DaySnapshot {
  state: DayState | null
  hasPendingWrites: boolean
}

export function subscribeDay(
  uid: string,
  dateKey: string,
  onChange: (snapshot: DaySnapshot) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    dayRef(uid, dateKey),
    { includeMetadataChanges: true },
    (snapshot) => {
      const data = snapshot.data()
      onChange({
        state: snapshot.exists() ? ((data?.state as DayState) ?? null) : null,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
      })
    },
    onError,
  )
}

export async function setDayOverride(
  uid: string,
  dateKey: string,
  state: DayState,
): Promise<void> {
  await setDoc(dayRef(uid, dateKey), {
    state,
    updatedAt: serverTimestamp(),
  })
}

export async function clearDayOverride(uid: string, dateKey: string): Promise<void> {
  await deleteDoc(dayRef(uid, dateKey))
}
