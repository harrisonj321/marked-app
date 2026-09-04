import { describe, expect, it } from 'vitest'
import {
  addMonths,
  compareYearMonth,
  formatMonthLabel,
  generateRollingMonths,
  getCalendarMonth,
  monthKeyRange,
  resolveCalendarDayView,
  yearMonthFromDateKey,
} from './calendar'

describe('getCalendarMonth', () => {
  it('generates the correct number of days for a 31-day month', () => {
    expect(getCalendarMonth(2026, 8).days).toHaveLength(31)
  })

  it('generates the correct number of days for a 30-day month', () => {
    expect(getCalendarMonth(2026, 9).days).toHaveLength(30)
  })

  it('handles February in a leap year (2024)', () => {
    expect(getCalendarMonth(2024, 2).days).toHaveLength(29)
  })

  it('handles February in a non-leap year (2026)', () => {
    expect(getCalendarMonth(2026, 2).days).toHaveLength(28)
  })

  it('handles the leap-year century rule (2000 is a leap year)', () => {
    expect(getCalendarMonth(2000, 2).days).toHaveLength(29)
  })

  it('handles the leap-year century rule (2100 is not a leap year)', () => {
    expect(getCalendarMonth(2100, 2).days).toHaveLength(28)
  })

  it('produces zero-padded YYYY-MM-DD date keys in order', () => {
    const days = getCalendarMonth(2026, 1).days
    expect(days[0].dateKey).toBe('2026-01-01')
    expect(days[8].dateKey).toBe('2026-01-09')
    expect(days.at(-1)?.dateKey).toBe('2026-01-31')
  })

  it('computes a leadingBlanks count between 0 and 6', () => {
    const { leadingBlanks } = getCalendarMonth(2026, 8)
    expect(leadingBlanks).toBeGreaterThanOrEqual(0)
    expect(leadingBlanks).toBeLessThanOrEqual(6)
  })
})

describe('monthKeyRange', () => {
  it('returns the first and last date keys of the month', () => {
    expect(monthKeyRange({ year: 2026, month: 2 })).toEqual({
      startKey: '2026-02-01',
      endKey: '2026-02-28',
    })
  })
})

describe('addMonths', () => {
  it('advances within the same year', () => {
    expect(addMonths({ year: 2026, month: 8 }, 1)).toEqual({ year: 2026, month: 9 })
  })

  it('rolls December to January of the next year', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
  })

  it('rolls January back to December of the previous year', () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
  })

  it('handles a February to March step regardless of leap year', () => {
    expect(addMonths({ year: 2024, month: 2 }, 1)).toEqual({ year: 2024, month: 3 })
  })

  it('handles multi-month deltas across a year boundary', () => {
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({ year: 2027, month: 2 })
  })
})

describe('generateRollingMonths', () => {
  it('returns count consecutive months, oldest first, ending at latest', () => {
    expect(generateRollingMonths({ year: 2026, month: 8 }, 3)).toEqual([
      { year: 2026, month: 6 },
      { year: 2026, month: 7 },
      { year: 2026, month: 8 },
    ])
  })

  it('crosses a year boundary correctly', () => {
    expect(generateRollingMonths({ year: 2026, month: 1 }, 3)).toEqual([
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
    ])
  })

  it('returns just latest when count is 1', () => {
    expect(generateRollingMonths({ year: 2026, month: 8 }, 1)).toEqual([{ year: 2026, month: 8 }])
  })

  it('clamps a non-positive count to still include latest', () => {
    expect(generateRollingMonths({ year: 2026, month: 8 }, 0)).toEqual([{ year: 2026, month: 8 }])
  })
})

describe('yearMonthFromDateKey', () => {
  it('parses year and month from a date key regardless of UTC/local offset', () => {
    expect(yearMonthFromDateKey('2026-08-10')).toEqual({ year: 2026, month: 8 })
  })
})

describe('compareYearMonth', () => {
  it('is negative when a is before b', () => {
    expect(compareYearMonth({ year: 2026, month: 1 }, { year: 2026, month: 2 })).toBeLessThan(0)
  })

  it('is zero for the same year-month', () => {
    expect(compareYearMonth({ year: 2026, month: 8 }, { year: 2026, month: 8 })).toBe(0)
  })

  it('is positive when a is after b, across a year boundary', () => {
    expect(compareYearMonth({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toBeGreaterThan(0)
  })
})

describe('formatMonthLabel', () => {
  it('formats a full month name and year', () => {
    expect(formatMonthLabel({ year: 2026, month: 8 })).toBe('August 2026')
  })

  it('formats December correctly at a year boundary', () => {
    expect(formatMonthLabel({ year: 2026, month: 12 })).toBe('December 2026')
  })
})

describe('resolveCalendarDayView', () => {
  const base = {
    dateKey: '2026-08-10',
    dayOfMonth: 10,
    todayKey: '2026-08-10',
    startDate: '2026-01-01',
    defaultState: 'did' as const,
    record: undefined,
  }

  it('marks a date after today as future and state-less', () => {
    const view = resolveCalendarDayView({ ...base, dateKey: '2026-08-11' })
    expect(view.status).toBe('future')
    expect(view.effectiveState).toBeNull()
  })

  it('marks today itself as active, not future', () => {
    const view = resolveCalendarDayView(base)
    expect(view.status).toBe('active')
    expect(view.isToday).toBe(true)
  })

  it('marks a date before the tracker start date as before-start and state-less', () => {
    const view = resolveCalendarDayView({ ...base, dateKey: '2025-12-31', dayOfMonth: 31 })
    expect(view.status).toBe('before-start')
    expect(view.effectiveState).toBeNull()
  })

  it('resolves the default state with no stored record', () => {
    const view = resolveCalendarDayView({ ...base, dateKey: '2026-08-05', todayKey: '2026-08-10' })
    expect(view.effectiveState).toBe('did')
    expect(view.isDefault).toBe(true)
  })

  it('resolves an explicit override as non-default', () => {
    const view = resolveCalendarDayView({
      ...base,
      dateKey: '2026-08-05',
      record: { state: 'didnt' },
    })
    expect(view.effectiveState).toBe('didnt')
    expect(view.isDefault).toBe(false)
  })

  it('reports hasNote when a note is present', () => {
    const view = resolveCalendarDayView({ ...base, record: { note: 'Sick' } })
    expect(view.hasNote).toBe(true)
  })

  it('reports a count only when effective state is did', () => {
    const didView = resolveCalendarDayView({ ...base, record: { count: 3 } })
    expect(didView.count).toBe(3)

    const didntView = resolveCalendarDayView({
      ...base,
      record: { state: 'didnt', count: 3 },
    })
    expect(didntView.count).toBeNull()
  })
})
