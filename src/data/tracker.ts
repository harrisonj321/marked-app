import { deleteDoc, doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { DayState, StateLabels, TrackerConfig } from '../domain/tracker'

/**
 * Everything here exists only to support reading -- and, once its migrated
 * ledger is deleted, retiring -- a pre-multi-ledger account's legacy
 * tracker document. The app never *writes new content* to this path once
 * multi-ledger support has shipped -- see LEGACY_LEDGER_ID in
 * domain/ledger.ts and data/ledger.ts's migration/deletion comments for why
 * the legacy day data itself is never moved.
 */
function trackerRef(uid: string) {
  return doc(db, 'users', uid, 'tracker', 'config')
}

function toTrackerConfig(data: Record<string, unknown>): TrackerConfig {
  return {
    name: data.name as string,
    defaultState: data.defaultState as DayState,
    timezone: data.timezone as string,
    startDate: data.startDate as string,
    stateLabels: data.stateLabels as StateLabels | undefined,
  }
}

/** One-shot read; returns null for an account that never had a legacy tracker (i.e. every genuinely new account). */
export async function getLegacyTracker(uid: string): Promise<TrackerConfig | null> {
  const snapshot = await getDoc(trackerRef(uid))
  return snapshot.exists() ? toTrackerConfig(snapshot.data()) : null
}

/**
 * Called only when the migrated ledgers/default ledger is itself being
 * deleted (see data/ledger.ts's deleteLedger) -- removes the legacy
 * pointer doc so a later migration check (a fresh session, another device)
 * has nothing left to resurrect that ledger from. Deleting a Firestore doc
 * that doesn't exist is a harmless no-op, so this is safe to call even if
 * it somehow runs twice.
 */
export async function deleteLegacyTracker(uid: string): Promise<void> {
  await deleteDoc(trackerRef(uid))
}
