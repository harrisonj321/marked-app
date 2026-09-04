import type { DailyRecord } from './day'
import { resolveEffectiveState, type DayState } from './tracker'

export interface YearMonth {
  year: number
  month: number // 1-12
}

export interface CalendarCell {
  dateKey: string
  dayOfMonth: number
}

export interface CalendarMonth {
  year: number
  month: number
  leadingBlanks: number
  days: CalendarCell[]
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0')
}

function buildDateKey(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

/**
 * Pure Gregorian calendar structure math over abstract (year, month)
 * integers. This is not derived from a real instant, so there is no local
 * timezone to get wrong by using Date.UTC here -- it is only used as a
 * calendar calculator (leap years, weekday-of-day-1, days-in-month).
 */
export function getCalendarMonth(year: number, month: number): CalendarMonth {
  const leadingBlanks = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const days: CalendarCell[] = []
  for (let day = 1; day <= totalDays; day++) {
    days.push({ dateKey: buildDateKey(year, month, day), dayOfMonth: day })
  }

  return { year, month, leadingBlanks, days }
}

export function monthKeyRange(yearMonth: YearMonth): { startKey: string; endKey: string } {
  const { days } = getCalendarMonth(yearMonth.year, yearMonth.month)
  return { startKey: days[0].dateKey, endKey: days[days.length - 1].dateKey }
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const total = year * 12 + (month - 1) + delta
  const normalizedMonth = ((total % 12) + 12) % 12
  return { year: Math.floor(total / 12), month: normalizedMonth + 1 }
}

/**
 * `count` consecutive months ending at (and including) `latest`, oldest
 * first -- the sequence a continuously-scrolling calendar renders, read
 * top-to-bottom. `count` is clamped to at least 1 so `latest`'s own month
 * always renders even if a caller derives a non-positive count.
 */
export function generateRollingMonths(latest: YearMonth, count: number): YearMonth[] {
  const clampedCount = Math.max(1, count)
  return Array.from({ length: clampedCount }, (_, index) => addMonths(latest, index - (clampedCount - 1)))
}

export function yearMonthFromDateKey(dateKey: string): YearMonth {
  const [year, month] = dateKey.split('-').map(Number)
  return { year, month }
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month)
}

export function formatMonthLabel(yearMonth: YearMonth): string {
  const date = new Date(Date.UTC(yearMonth.year, yearMonth.month - 1, 1))
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export type CalendarDayStatus = 'future' | 'before-start' | 'active'

export interface CalendarDayView {
  dateKey: string
  dayOfMonth: number
  status: CalendarDayStatus
  isToday: boolean
  effectiveState: DayState | null
  isDefault: boolean
  hasNote: boolean
  count: number | null
}

export interface ResolveCalendarDayViewInput {
  dateKey: string
  dayOfMonth: number
  todayKey: string
  startDate: string
  defaultState: DayState
  record: DailyRecord | undefined
}

const INACTIVE_VIEW_BASE = {
  isToday: false,
  effectiveState: null,
  isDefault: false,
  hasNote: false,
  count: null,
} as const

export function resolveCalendarDayView(input: ResolveCalendarDayViewInput): CalendarDayView {
  const { dateKey, dayOfMonth, todayKey, startDate, defaultState, record } = input

  if (dateKey > todayKey) {
    return { dateKey, dayOfMonth, status: 'future', ...INACTIVE_VIEW_BASE }
  }
  if (dateKey < startDate) {
    return { dateKey, dayOfMonth, status: 'before-start', ...INACTIVE_VIEW_BASE }
  }

  const effectiveState = resolveEffectiveState(defaultState, record?.state ?? null)
  return {
    dateKey,
    dayOfMonth,
    status: 'active',
    isToday: dateKey === todayKey,
    effectiveState,
    isDefault: effectiveState === defaultState,
    hasNote: Boolean(record?.note),
    count: effectiveState === 'did' && record?.count ? record.count : null,
  }
}
