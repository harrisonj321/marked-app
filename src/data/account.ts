import { LEGACY_LEDGER_ID } from '../domain/ledger'
import { deleteAppSettings } from './appSettings'
import { deleteLedgerDays } from './day'
import { deleteLedger, listLedgerIds } from './ledger'
import { deleteLegacyTracker } from './tracker'

/**
 * Permanently deletes every piece of Firestore data this account owns:
 * every ledger and its days (deleteLedger already retires the legacy
 * tracker/config + users/{uid}/days when 'default' is among them -- see its
 * own comment), plus settings/app. Must complete before the caller deletes
 * the Firebase Auth identity itself (see lib/auth.ts's deleteAuthAccount) --
 * once that succeeds the client can no longer pass Firestore's isOwner
 * check to clean anything up.
 */
export async function deleteAllUserData(uid: string): Promise<void> {
  const ledgerIds = await listLedgerIds(uid)
  for (const ledgerId of ledgerIds) {
    await deleteLedger(uid, ledgerId)
  }

  // Defensive: a legacy tracker/config + users/{uid}/days can only still
  // exist without a corresponding ledgers/default doc if this session's
  // migration hasn't run yet (see useLedgers) -- deleteLedger above already
  // retires both when 'default' is among ledgerIds, but this guarantees it
  // either way. Deleting already-deleted or never-existing data is a
  // harmless no-op.
  await deleteLedgerDays(uid, LEGACY_LEDGER_ID)
  await deleteLegacyTracker(uid)

  await deleteAppSettings(uid)
}
