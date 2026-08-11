import { describe, expect, it } from 'vitest'
import {
  COUNT_MAX,
  COUNT_OTHER_MIN,
  NOTE_MAX_LENGTH,
  formatCount,
  modeForCount,
  normalizeDailyRecord,
  validateCount,
  validateNote,
  validateOtherCount,
} from './day'

describe('normalizeDailyRecord', () => {
  it('normalizes to delete when nothing explicit exists', () => {
    expect(
      normalizeDailyRecord({ defaultState: 'did', effectiveState: 'did' }),
    ).toEqual({ kind: 'delete' })
  })

  it('produces an override-only document when effective state differs from default', () => {
    expect(
      normalizeDailyRecord({ defaultState: 'did', effectiveState: 'didnt' }),
    ).toEqual({ kind: 'set', state: 'didnt' })
  })

  it('produces a note-only document on an otherwise default day', () => {
    expect(
      normalizeDailyRecord({ defaultState: 'did', effectiveState: 'did', note: 'Hotel gym' }),
    ).toEqual({ kind: 'set', note: 'Hotel gym' })
  })

  it('produces a count-only document when the day is did via default alone', () => {
    expect(
      normalizeDailyRecord({ defaultState: 'did', effectiveState: 'did', count: 3 }),
    ).toEqual({ kind: 'set', count: 3 })
  })

  it('combines state override, note, and count when all apply', () => {
    expect(
      normalizeDailyRecord({
        defaultState: 'didnt',
        effectiveState: 'did',
        note: 'Hotel gym',
        count: 2,
      }),
    ).toEqual({ kind: 'set', state: 'did', note: 'Hotel gym', count: 2 })
  })

  it('drops a count of exactly one -- it is implicit', () => {
    expect(
      normalizeDailyRecord({ defaultState: 'did', effectiveState: 'did', count: 1 }),
    ).toEqual({ kind: 'delete' })
  })

  it('removes count when the desired effective state becomes didnt', () => {
    expect(
      normalizeDailyRecord({ defaultState: 'did', effectiveState: 'didnt', count: 3 }),
    ).toEqual({ kind: 'set', state: 'didnt' })
  })

  it('returning to default while a note remains keeps the note, drops the state override', () => {
    expect(
      normalizeDailyRecord({
        defaultState: 'did',
        effectiveState: 'did',
        note: 'Still here',
      }),
    ).toEqual({ kind: 'set', note: 'Still here' })
  })

  it('returning to default with no note/count deletes the document', () => {
    expect(
      normalizeDailyRecord({ defaultState: 'didnt', effectiveState: 'didnt', note: '' }),
    ).toEqual({ kind: 'delete' })
  })

  it('trims and removes a whitespace-only note', () => {
    expect(
      normalizeDailyRecord({ defaultState: 'did', effectiveState: 'did', note: '   ' }),
    ).toEqual({ kind: 'delete' })
  })

  it('trims a note with surrounding whitespace', () => {
    expect(
      normalizeDailyRecord({ defaultState: 'did', effectiveState: 'did', note: '  Sick  ' }),
    ).toEqual({ kind: 'set', note: 'Sick' })
  })
})

describe('validateNote', () => {
  it('accepts and trims a short note', () => {
    expect(validateNote('  Sick  ')).toEqual({ valid: true, note: 'Sick' })
  })

  it('treats an empty/whitespace-only note as removal, not an error', () => {
    expect(validateNote('')).toEqual({ valid: true, note: undefined })
    expect(validateNote('   ')).toEqual({ valid: true, note: undefined })
  })

  it('rejects a note over the maximum length', () => {
    const result = validateNote('a'.repeat(NOTE_MAX_LENGTH + 1))
    expect(result.valid).toBe(false)
  })

  it('accepts a note at exactly the maximum length', () => {
    const result = validateNote('a'.repeat(NOTE_MAX_LENGTH))
    expect(result.valid).toBe(true)
  })
})

describe('validateCount', () => {
  it('treats blank input as no explicit count', () => {
    expect(validateCount('')).toEqual({ valid: true, count: undefined })
  })

  it('treats 1 as no explicit count needed', () => {
    expect(validateCount('1')).toEqual({ valid: true, count: undefined })
  })

  it('accepts a valid count greater than one', () => {
    expect(validateCount('3')).toEqual({ valid: true, count: 3 })
  })

  it('rejects a non-integer value', () => {
    expect(validateCount('2.5').valid).toBe(false)
    expect(validateCount('abc').valid).toBe(false)
  })

  it('rejects a count above the maximum', () => {
    expect(validateCount(String(COUNT_MAX + 1)).valid).toBe(false)
  })

  it('accepts a count at exactly the maximum', () => {
    expect(validateCount(String(COUNT_MAX))).toEqual({ valid: true, count: COUNT_MAX })
  })

  it('rejects a negative count', () => {
    expect(validateCount('-1').valid).toBe(false)
  })
})

describe('validateOtherCount', () => {
  it('rejects blank input -- the Other field requires an explicit value', () => {
    expect(validateOtherCount('').valid).toBe(false)
  })

  it('rejects a non-integer value', () => {
    expect(validateOtherCount('4.5').valid).toBe(false)
    expect(validateOtherCount('abc').valid).toBe(false)
  })

  it('rejects a value at or below the dedicated 2x/3x range', () => {
    expect(validateOtherCount('1').valid).toBe(false)
    expect(validateOtherCount('2').valid).toBe(false)
    expect(validateOtherCount('3').valid).toBe(false)
  })

  it('accepts a value at exactly the minimum', () => {
    expect(validateOtherCount(String(COUNT_OTHER_MIN))).toEqual({
      valid: true,
      count: COUNT_OTHER_MIN,
    })
  })

  it('accepts a value at exactly the maximum', () => {
    expect(validateOtherCount(String(COUNT_MAX))).toEqual({ valid: true, count: COUNT_MAX })
  })

  it('rejects a value above the maximum', () => {
    expect(validateOtherCount(String(COUNT_MAX + 1)).valid).toBe(false)
  })
})

describe('modeForCount', () => {
  it('maps an unset count to the normal single occurrence', () => {
    expect(modeForCount(undefined)).toBe('none')
  })

  it('maps 2 and 3 to their dedicated quick options', () => {
    expect(modeForCount(2)).toBe('two')
    expect(modeForCount(3)).toBe('three')
  })

  it('maps any other value to Other', () => {
    expect(modeForCount(9)).toBe('other')
  })
})

describe('formatCount', () => {
  it('formats compactly with a multiplication sign', () => {
    expect(formatCount(2)).toBe('2×')
    expect(formatCount(15)).toBe('15×')
  })
})
