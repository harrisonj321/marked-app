import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { DayState, StateLabels } from '../domain/tracker'
import { LEGACY_LEDGER_ID, type Ledger, type LedgerColor } from '../domain/ledger'
import { deleteLegacyTracker, getLegacyTracker } from './tracker'
import { deleteLedgerDays, pinImplicitDayStates } from './day'

function ledgersCollection(uid: string) {
  return collection(db, 'users', uid, 'ledgers')
}

function ledgerRef(uid: string, ledgerId: string) {
  return doc(ledgersCollection(uid), ledgerId)
}

function toLedger(id: string, data: Record<string, unknown>): Ledger {
  return {
    id,
    name: data.name as string,
    defaultState: data.defaultState as DayState,
    timezone: data.timezone as string,
    startDate: data.startDate as string,
    stateLabels: data.stateLabels as StateLabels | undefined,
    color: data.color as LedgerColor | undefined,
  }
}

export interface NewLedger {
  name: string
  defaultState: DayState
  timezone: string
  startDate: string
  color?: LedgerColor
}

/** Creates a new ledger with a fresh id and returns it. */
export async function createLedger(uid: string, input: NewLedger): Promise<Ledger> {
  const ref = doc(ledgersCollection(uid))
  const data: Record<string, unknown> = {
    name: input.name,
    defaultState: input.defaultState,
    timezone: input.timezone,
    startDate: input.startDate,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  if (input.color) data.color = input.color

  await setDoc(ref, data)

  return {
    id: ref.id,
    name: input.name,
    defaultState: input.defaultState,
    timezone: input.timezone,
    startDate: input.startDate,
    color: input.color,
  }
}

export async function updateLedgerName(uid: string, ledgerId: string, name: string): Promise<void> {
  await updateDoc(ledgerRef(uid, ledgerId), { name, updatedAt: serverTimestamp() })
}

export async function updateLedgerStateLabels(
  uid: string,
  ledgerId: string,
  stateLabels: StateLabels,
): Promise<void> {
  await updateDoc(ledgerRef(uid, ledgerId), { stateLabels, updatedAt: serverTimestamp() })
}

/** `color: null` removes the ledger's color entirely, back to unset. */
export async function updateLedgerColor(
  uid: string,
  ledgerId: string,
  color: LedgerColor | null,
): Promise<void> {
  await updateDoc(ledgerRef(uid, ledgerId), {
    color: color ?? deleteField(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Changes what an untouched day counts as for this one ledger. See
 * data/day.ts's pinImplicitDayStates for why the previous default is
 * pinned onto every already-recorded day first.
 */
export async function updateLedgerDefaultState(
  uid: string,
  ledgerId: string,
  currentDefaultState: DayState,
  nextDefaultState: DayState,
): Promise<void> {
  if (currentDefaultState === nextDefaultState) {
    return
  }

  await pinImplicitDayStates(uid, ledgerId, currentDefaultState)
  await updateDoc(ledgerRef(uid, ledgerId), {
    defaultState: nextDefaultState,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Removing a ledger removes its history too -- see data/day.ts's
 * deleteLedgerDays.
 *
 * For the legacy-migrated ledger specifically, this must also retire the
 * legacy tracker/config doc it was mirrored from (see
 * deleteLegacyTracker's own comment): without that, a fresh session's
 * migration check would find tracker/config still present and resurrect
 * the very ledger the user just deleted, since in-memory guards against
 * re-migrating (see useLedgers) don't survive a reload/sign-out/sign-in.
 *
 * Done first, before anything is actually removed: if it fails, nothing
 * else has happened yet and the whole deletion is safely retryable from
 * scratch; if it succeeds but a later step fails, resurrection is already
 * impossible even though the ledger doc/some days may still need a retry
 * to finish disappearing.
 */
export async function deleteLedger(uid: string, ledgerId: string): Promise<void> {
  if (ledgerId === LEGACY_LEDGER_ID) {
    await deleteLegacyTracker(uid)
  }
  await deleteLedgerDays(uid, ledgerId)
  await deleteDoc(ledgerRef(uid, ledgerId))
}

export function subscribeLedgers(
  uid: string,
  onChange: (ledgers: Ledger[]) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const ledgersQuery = query(ledgersCollection(uid), orderBy('createdAt', 'asc'))
  return onSnapshot(
    ledgersQuery,
    (snapshot) => {
      onChange(snapshot.docs.map((docSnapshot) => toLedger(docSnapshot.id, docSnapshot.data())))
    },
    onError,
  )
}

/**
 * One-time, idempotent migration for accounts that predate multi-ledger
 * support: mirrors the legacy tracker/config doc into ledgers/default,
 * without moving or copying any daily entries -- see data/day.ts's
 * LEGACY_LEDGER_ID routing, which keeps that ledger's days at their
 * original users/{uid}/days path forever. This is what makes the
 * migration safe against production data: it only ever adds one small
 * document, so it structurally cannot lose or orphan anything.
 *
 * The one thing this function must never do is resurrect a ledger the user
 * deliberately deleted -- that's why deleteLedger removes tracker/config
 * itself when "default" is deleted (see its own comment): once that doc is
 * gone, getLegacyTracker below returns null and this correctly stays a
 * no-op, even on a completely fresh session with no shared in-memory state.
 *
 * Safe to call from any number of concurrent tabs/sessions, or more than
 * once: it checks for an existing ledgers/default doc first and returns
 * that untouched if already present, and returns null (nothing to do) for
 * a genuinely new account with no legacy tracker at all.
 */
export async function migrateLegacyTrackerIfNeeded(uid: string): Promise<Ledger | null> {
  const existing = await getDoc(ledgerRef(uid, LEGACY_LEDGER_ID))
  if (existing.exists()) {
    return toLedger(existing.id, existing.data())
  }

  const legacy = await getLegacyTracker(uid)
  if (!legacy) {
    return null
  }

  const data: Record<string, unknown> = {
    name: legacy.name,
    defaultState: legacy.defaultState,
    timezone: legacy.timezone,
    startDate: legacy.startDate,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  if (legacy.stateLabels) data.stateLabels = legacy.stateLabels

  await setDoc(ledgerRef(uid, LEGACY_LEDGER_ID), data)

  return {
    id: LEGACY_LEDGER_ID,
    name: legacy.name,
    defaultState: legacy.defaultState,
    timezone: legacy.timezone,
    startDate: legacy.startDate,
    stateLabels: legacy.stateLabels,
  }
}
