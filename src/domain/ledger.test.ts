import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LEDGER_COLOR,
  LEDGER_COLORS,
  isLedgerColor,
  resolveActiveLedgerId,
  resolveLedgerColor,
  type Ledger,
} from './ledger'

function ledger(id: string): Ledger {
  return { id, name: id, defaultState: 'did', timezone: 'UTC', startDate: '2026-01-01' }
}

describe('resolveActiveLedgerId', () => {
  it('returns the requested id when it exists among the ledgers', () => {
    const ledgers = [ledger('a'), ledger('b')]
    expect(resolveActiveLedgerId(ledgers, 'b')).toBe('b')
  })

  it('falls back to the first ledger when the requested id is not found', () => {
    const ledgers = [ledger('a'), ledger('b')]
    expect(resolveActiveLedgerId(ledgers, 'missing')).toBe('a')
  })

  it('falls back to the first ledger when no id was requested', () => {
    const ledgers = [ledger('a'), ledger('b')]
    expect(resolveActiveLedgerId(ledgers, null)).toBe('a')
  })

  it('returns null when there are no ledgers at all', () => {
    expect(resolveActiveLedgerId([], 'anything')).toBeNull()
    expect(resolveActiveLedgerId([], null)).toBeNull()
  })
})

describe('isLedgerColor', () => {
  it('accepts every color in the fixed palette', () => {
    for (const color of LEDGER_COLORS) {
      expect(isLedgerColor(color)).toBe(true)
    }
  })

  it('rejects an arbitrary string, including freeform hex', () => {
    expect(isLedgerColor('#ff0000')).toBe(false)
    expect(isLedgerColor('red')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isLedgerColor(undefined)).toBe(false)
    expect(isLedgerColor(null)).toBe(false)
    expect(isLedgerColor(42)).toBe(false)
  })
})

describe('resolveLedgerColor', () => {
  it('resolves an explicitly stored color to itself', () => {
    for (const color of LEDGER_COLORS) {
      expect(resolveLedgerColor(color)).toBe(color)
    }
  })

  it('resolves no stored color to the canonical default -- espresso, the original Marked. accent', () => {
    expect(resolveLedgerColor(undefined)).toBe('espresso')
    expect(resolveLedgerColor(undefined)).toBe(DEFAULT_LEDGER_COLOR)
  })

  it('espresso is a real, ordinary member of the palette, not a separate concept', () => {
    expect(LEDGER_COLORS).toContain('espresso')
    expect(isLedgerColor('espresso')).toBe(true)
  })
})
