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
 * quiet palette. Leads with 'espresso', the original dark brown Marked. has
 * always used for its one shared accent (see `--color-accent` in
 * index.css): every ledger resolves to a real color from this list (see
 * `resolveLedgerColor`), and espresso is what an otherwise-uncolored ledger
 * -- including the legacy migrated one -- has always actually rendered as.
 */
export const LEDGER_COLORS = ['espresso', 'clay', 'moss', 'dust', 'plum', 'rose', 'straw'] as const

export type LedgerColor = (typeof LEDGER_COLORS)[number]

export const LEDGER_COLOR_LABELS: Record<LedgerColor, string> = {
  espresso: 'Espresso',
  clay: 'Clay',
  moss: 'Moss',
  dust: 'Dust',
  plum: 'Plum',
  rose: 'Rose',
  straw: 'Straw',
}

/**
 * The canonical resolved color for a ledger with no explicitly stored
 * color -- the same brown/espresso the today-toggle has always shown via
 * `--color-accent`, just now available as a real, selectable palette entry
 * rather than an implicit CSS fallback. New ledgers that don't otherwise
 * specify a color should also start here, so there is exactly one default
 * source, not a separate one per surface.
 */
export const DEFAULT_LEDGER_COLOR: LedgerColor = 'espresso'

export function isLedgerColor(value: unknown): value is LedgerColor {
  return typeof value === 'string' && (LEDGER_COLORS as readonly string[]).includes(value)
}

/**
 * Every ledger has a real, renderable color -- this is the one place that
 * turns "no color was ever stored" into the actual value to show/select,
 * so the active toggle and the Settings color picker can never disagree
 * about what a ledger's color is (see DEFAULT_LEDGER_COLOR).
 */
export function resolveLedgerColor(color: LedgerColor | undefined): LedgerColor {
  return color ?? DEFAULT_LEDGER_COLOR
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
