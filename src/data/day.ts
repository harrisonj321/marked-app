import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { DailyRecord, NormalizedDailyRecord } from '../domain/day'
import type { DayState } from '../domain/tracker'

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

/** Firestore caps a single batch at 500 writes; stay clear of the edge. */
const PIN_BATCH_SIZE = 400

/**
 * Writes the state a day already resolves to onto every existing day
 * document that has none of its own.
 *
 * A day document is stored sparsely: it holds a state only when that
 * state differs from the tracker default, so a note-only or count-only
 * day carries its state implicitly. Making those implicit states
 * explicit *before* the default changes is what keeps a recorded day
 * saying the same thing afterwards. Days with no document at all are
 * untouched days and are deliberately left to follow the new default.
 *
 * Writing a state a document already resolves to changes nothing about
 * what that day means, so a partially applied run is harmless and safe
 * to repeat.
 */
export async function pinImplicitDayStates(uid: string, state: DayState): Promise<void> {
  const snapshot = await getDocs(daysCollection(uid))
  const implicit = snapshot.docs.filter((docSnapshot) => !toDailyRecord(docSnapshot.data()).state)

  for (let index = 0; index < implicit.length; index += PIN_BATCH_SIZE) {
    const batch = writeBatch(db)
    for (const docSnapshot of implicit.slice(index, index + PIN_BATCH_SIZE)) {
      batch.update(docSnapshot.ref, { state, updatedAt: serverTimestamp() })
    }
    await batch.commit()
  }
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
