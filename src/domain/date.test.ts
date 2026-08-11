import { describe, expect, it } from 'vitest'
import {
  formatDisplayDate,
  getLocalDateKey,
  getTodayKey,
  millisecondsUntilNextLocalMidnight,
} from './date'

describe('getLocalDateKey', () => {
  it('formats as YYYY-MM-DD', () => {
    const date = new Date('2026-08-10T12:00:00Z')
    expect(getLocalDateKey(date, 'UTC')).toBe('2026-08-10')
  })

  it('does not roll forward to the next UTC day for a timezone behind UTC', () => {
    // 11:55 PM local time in Los Angeles (UTC-7, PDT in August) on Aug 10
    // is 2026-08-11T06:55:00Z -- already the next day in UTC.
    const date = new Date('2026-08-11T06:55:00Z')
    expect(getLocalDateKey(date, 'America/Los_Angeles')).toBe('2026-08-10')
    expect(getLocalDateKey(date, 'UTC')).toBe('2026-08-11')
  })

  it('does not lag behind the previous UTC day for a timezone ahead of UTC', () => {
    // Just after midnight in Tokyo (UTC+9) is still the previous day in UTC.
    const date = new Date('2026-08-09T15:05:00Z')
    expect(getLocalDateKey(date, 'Asia/Tokyo')).toBe('2026-08-10')
    expect(getLocalDateKey(date, 'UTC')).toBe('2026-08-09')
  })

  it('pads single-digit months and days', () => {
    const date = new Date('2026-01-05T12:00:00Z')
    expect(getLocalDateKey(date, 'UTC')).toBe('2026-01-05')
  })
})

describe('getTodayKey', () => {
  it('returns a well-formed YYYY-MM-DD key', () => {
    expect(getTodayKey('UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('formatDisplayDate', () => {
  it('converts an internal YYYY-MM-DD key to MM/DD/YYYY for display', () => {
    expect(formatDisplayDate('2026-08-10')).toBe('08/10/2026')
  })
})

describe('millisecondsUntilNextLocalMidnight', () => {
  it('returns the full day length at exactly local midnight', () => {
    // 2026-08-10T07:00:00Z is exactly 00:00:00 in Los Angeles (PDT, UTC-7).
    const date = new Date('2026-08-10T07:00:00Z')
    expect(millisecondsUntilNextLocalMidnight(date, 'America/Los_Angeles')).toBe(
      24 * 60 * 60 * 1000,
    )
  })

  it('returns a small value one second before local midnight', () => {
    // 2026-08-11T06:59:59Z is 23:59:59 the prior day in Los Angeles.
    const date = new Date('2026-08-11T06:59:59Z')
    expect(millisecondsUntilNextLocalMidnight(date, 'America/Los_Angeles')).toBe(1000)
  })

  it('is timezone-aware for the same instant', () => {
    const date = new Date('2026-08-10T12:00:00Z')
    const la = millisecondsUntilNextLocalMidnight(date, 'America/Los_Angeles')
    const tokyo = millisecondsUntilNextLocalMidnight(date, 'Asia/Tokyo')
    expect(la).not.toBe(tokyo)
  })
})
