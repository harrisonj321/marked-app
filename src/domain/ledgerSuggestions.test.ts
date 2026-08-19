import { describe, expect, it } from 'vitest'
import { LEDGER_NAME_SUGGESTIONS } from './ledgerSuggestions'

describe('LEDGER_NAME_SUGGESTIONS', () => {
  it('offers the agreed, deliberately varied set of examples', () => {
    expect(LEDGER_NAME_SUGGESTIONS).toEqual([
      'Worked out',
      'Ate out',
      'Headache',
      'Drank alcohol',
      'Cooked dinner',
      'Good day',
    ])
  })
})
