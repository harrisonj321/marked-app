import type { TrackerConfig } from './tracker'

/**
 * A user may have several independent ledgers, but only ever views one at a
 * time -- this is that one ledger's full configuration, `id` included since
 * a Firestore document's id is never part of its own data.
 */
export interface Ledger extends TrackerConfig {
  id: string
}

/**
 * Every pre-multi-ledger account is migrated into exactly one ledger at
 * this fixed id. It is the one case where a ledger's daily entries do NOT
 * live under `ledgers/{id}/days` -- see data/day.ts -- so that migrating an
 * existing account never has to move or risk losing its history.
 */
export const LEGACY_LEDGER_ID = 'default'

/**
 * A small, fixed set of muted, cloth-like identifying colors -- not
 * freeform hex, so a ledger's color can never clash with the app's warm,
 * quiet palette. Deliberately has no "default"/first entry that reads as
 * the encouraged choice; ledgers start with no color at all (see
 * `LedgerColor | undefined` throughout) until the user picks one.
 */
export const LEDGER_COLORS = ['clay', 'moss', 'dust', 'plum', 'rose', 'straw'] as const

export type LedgerColor = (typeof LEDGER_COLORS)[number]

export const LEDGER_COLOR_LABELS: Record<LedgerColor, string> = {
  clay: 'Clay',
  moss: 'Moss',
  dust: 'Dust',
  plum: 'Plum',
  rose: 'Rose',
  straw: 'Straw',
}

export function isLedgerColor(value: unknown): value is LedgerColor {
  return typeof value === 'string' && (LEDGER_COLORS as readonly string[]).includes(value)
}

/**
 * Resolves which ledger should be showing: the requested id if it still
 * exists, otherwise the first ledger (stable creation order), otherwise
 * none. Used both to render the active ledger and, by the caller, to
 * self-heal a stored selection that no longer points at anything real
 * (e.g. that ledger was deleted from another device).
 */
export function resolveActiveLedgerId(
  ledgers: readonly Ledger[],
  requestedId: string | null,
): string | null {
  if (requestedId && ledgers.some((ledger) => ledger.id === requestedId)) {
    return requestedId
  }
  return ledgers[0]?.id ?? null
}
