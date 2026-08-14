import { useEffect, useState } from 'react'
import { migrateLegacyTrackerIfNeeded, subscribeLedgers } from '../data/ledger'
import { setActiveLedgerId, subscribeActiveLedgerId } from '../data/appSettings'
import { resolveActiveLedgerId, type Ledger } from '../domain/ledger'

export interface LedgersState {
  ledgers: Ledger[]
  activeLedger: Ledger | null
  loading: boolean
  error: string | null
  switchLedger: (ledgerId: string) => void
}

const LOADING_STATE: LedgersState = {
  ledgers: [],
  activeLedger: null,
  loading: true,
  error: null,
  switchLedger: () => {},
}

const SIGNED_OUT_STATE: LedgersState = { ...LOADING_STATE, loading: false }

/**
 * Resolves the full multi-ledger picture for one account: the live list of
 * ledgers, which one is active, and the one-time invisible migration for an
 * account that predates multi-ledger support (see
 * migrateLegacyTrackerIfNeeded). `loading` stays true until all of that has
 * settled, so App never flashes the "create your first ledger" screen for
 * an existing account whose migration just hasn't finished yet.
 *
 * Also self-heals: if the persisted active-ledger id doesn't match any
 * current ledger (e.g. it was deleted, possibly from another device), this
 * resolves to a sensible fallback and persists the correction -- see
 * resolveActiveLedgerId.
 */
export function useLedgers(uid: string | null): LedgersState {
  const [ledgers, setLedgers] = useState<Ledger[]>([])
  const [ledgersLoaded, setLedgersLoaded] = useState(false)
  const [storedActiveLedgerId, setStoredActiveLedgerId] = useState<string | null>(null)
  const [activeIdLoaded, setActiveIdLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The uid for which the legacy-migration check has already run (attempted
  // or genuinely not needed). Naturally differs from a fresh uid right
  // after a sign-out/sign-in, so no separate reset step is required --
  // unlike a ref-based flag, this can't be mutated during render.
  const [migratedForUid, setMigratedForUid] = useState<string | null>(null)

  // Reset synchronously during render when uid changes (sign-out, or
  // sign-in as a different user), rather than via an effect -- mirrors the
  // pattern used by the other data-subscription hooks in this codebase.
  const [trackedUid, setTrackedUid] = useState(uid)
  if (uid !== trackedUid) {
    setTrackedUid(uid)
    setLedgers([])
    setLedgersLoaded(false)
    setStoredActiveLedgerId(null)
    setActiveIdLoaded(false)
    setError(null)
  }

  useEffect(() => {
    if (!uid) return
    return subscribeLedgers(
      uid,
      (next) => {
        setLedgers(next)
        setLedgersLoaded(true)
      },
      () => setError('Could not load your ledgers. Try again.'),
    )
  }, [uid])

  useEffect(() => {
    if (!uid) return
    return subscribeActiveLedgerId(
      uid,
      (id) => {
        setStoredActiveLedgerId(id)
        setActiveIdLoaded(true)
      },
      // Non-fatal: an account with no explicit selection yet (or a
      // transient read error) just falls back to the first ledger below.
      () => setActiveIdLoaded(true),
    )
  }, [uid])

  // Only attempted once the ledger list is confirmed empty, and only once
  // per uid (migratedForUid === uid short-circuits every re-run after,
  // including if the ledger list later drops back to empty because the
  // user deleted their only ledger -- that must never resurrect it from
  // the legacy snapshot). Seeds `ledgers` locally with whatever the
  // migration created, rather than waiting for the live subscription to
  // echo it back, so there is never a frame where a migrated account's
  // ledgers look empty.
  useEffect(() => {
    if (!uid || !ledgersLoaded || ledgers.length > 0 || migratedForUid === uid) {
      return
    }

    migrateLegacyTrackerIfNeeded(uid)
      .then((created) => {
        if (created) setLedgers([created])
      })
      .catch(() => setError('Could not load your ledgers. Try again.'))
      .finally(() => setMigratedForUid(uid))
  }, [uid, ledgersLoaded, ledgers.length, migratedForUid])

  const activeLedgerId = resolveActiveLedgerId(ledgers, storedActiveLedgerId)

  // Self-healing persistence: only writes when the resolved id is real and
  // actually differs from what is stored, so a genuinely-empty account
  // never writes a selection pointing at nothing.
  useEffect(() => {
    if (!uid || !ledgersLoaded || !activeIdLoaded) return
    if (activeLedgerId && activeLedgerId !== storedActiveLedgerId) {
      setActiveLedgerId(uid, activeLedgerId).catch(() => {})
    }
  }, [uid, ledgersLoaded, activeIdLoaded, activeLedgerId, storedActiveLedgerId])

  if (!uid) {
    return SIGNED_OUT_STATE
  }
  const currentUid = uid

  const settledEmpty = ledgersLoaded && ledgers.length === 0 && migratedForUid === uid
  const loading = !(activeIdLoaded && (ledgers.length > 0 ? ledgersLoaded : settledEmpty))

  function switchLedger(ledgerId: string) {
    setActiveLedgerId(currentUid, ledgerId).catch(() => setError('Could not switch ledgers. Try again.'))
  }

  return {
    ledgers,
    activeLedger: ledgers.find((ledger) => ledger.id === activeLedgerId) ?? null,
    loading,
    error,
    switchLedger,
  }
}
