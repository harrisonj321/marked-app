import {
  collection,
  deleteDoc,
  doc,
  documentId,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { DailyRecord, NormalizedDailyRecord } from '../domain/day'

function dayRef(uid: string, dateKey: string) {
  return doc(db, 'users', uid, 'days', dateKey)
}

function daysCollection(uid: string) {
  return collection(db, 'users', uid, 'days')
}

/** Narrows raw Firestore data to a well-typed record; unknown/invalid shapes are dropped. */
function toDailyRecord(data: Record<string, unknown> | undefined): DailyRecord {
  if (!data) return {}

  const record: DailyRecord = {}
  if (data.state === 'did' || data.state === 'didnt') {
    record.state = data.state
  }
  if (typeof data.note === 'string' && data.note.trim().length > 0) {
    record.note = data.note
  }
  if (typeof data.count === 'number' && Number.isInteger(data.count) && data.count > 1) {
    record.count = data.count
  }
  return record
}

export interface DaySnapshot {
  record: DailyRecord
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
      onChange({
        record: toDailyRecord(snapshot.data()),
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
      })
    },
    onError,
  )
}

export type MonthRecords = ReadonlyMap<string, DailyRecord>

/** Live range query over the days subcollection for one visible month only. */
export function subscribeMonth(
  uid: string,
  startKey: string,
  endKey: string,
  onChange: (records: MonthRecords) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const monthQuery = query(
    daysCollection(uid),
    where(documentId(), '>=', startKey),
    where(documentId(), '<=', endKey),
  )

  return onSnapshot(
    monthQuery,
    (snapshot) => {
      const records = new Map<string, DailyRecord>()
      snapshot.forEach((docSnapshot) => {
        records.set(docSnapshot.id, toDailyRecord(docSnapshot.data()))
      })
      onChange(records)
    },
    onError,
  )
}

/** Writes or deletes a day document from its already-normalized form. */
export async function saveDailyRecord(
  uid: string,
  dateKey: string,
  normalized: NormalizedDailyRecord,
): Promise<void> {
  const ref = dayRef(uid, dateKey)

  if (normalized.kind === 'delete') {
    await deleteDoc(ref)
    return
  }

  const data: Record<string, unknown> = { updatedAt: serverTimestamp() }
  if (normalized.state !== undefined) data.state = normalized.state
  if (normalized.note !== undefined) data.note = normalized.note
  if (normalized.count !== undefined) data.count = normalized.count
  await setDoc(ref, data)
}
