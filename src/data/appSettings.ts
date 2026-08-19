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

/**
 * Account-wide app state that is not itself ledger data -- currently just
 * which ledger is active, so reopening the app (on any device) returns to
 * it. Deliberately not localStorage: unlike onboarding's device-local UI
 * state, this determines which synced data loads, so it belongs in the
 * same synced store as everything else.
 */
function appSettingsRef(uid: string) {
  return doc(db, 'users', uid, 'settings', 'app')
}

/** Null covers both "no doc yet" (never explicitly switched) and a malformed value. */
export function subscribeActiveLedgerId(
  uid: string,
  onChange: (activeLedgerId: string | null) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    appSettingsRef(uid),
    (snapshot) => {
      const data = snapshot.data()
      onChange(typeof data?.activeLedgerId === 'string' ? data.activeLedgerId : null)
    },
    onError,
  )
}

/** Full overwrite rather than a partial update: this doc's entire shape is just these two fields. */
export async function setActiveLedgerId(uid: string, ledgerId: string): Promise<void> {
  await setDoc(appSettingsRef(uid), { activeLedgerId: ledgerId, updatedAt: serverTimestamp() })
}

/** Only meaningful as part of full account deletion -- see data/account.ts's deleteAllUserData. */
export async function deleteAppSettings(uid: string): Promise<void> {
  await deleteDoc(appSettingsRef(uid))
}
