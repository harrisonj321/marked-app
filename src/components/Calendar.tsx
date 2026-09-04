import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import {
  compareYearMonth,
  formatMonthLabel,
  generateRollingMonths,
  getCalendarMonth,
  monthKeyRange,
  resolveCalendarDayView,
  yearMonthFromDateKey,
  type CalendarDayView,
  type YearMonth,
} from '../domain/calendar'
import { formatDisplayDate } from '../domain/date'
import { formatCount, type NormalizedDailyRecord } from '../domain/day'
import { resolveStateLabels, type StateLabels } from '../domain/tracker'
import { resolveLedgerColor, type Ledger } from '../domain/ledger'
import { saveDailyRecord, type MonthRecords } from '../data/day'
import { useRangeRecords } from '../hooks/useRangeRecords'
import { DayDetail } from './DayDetail'

interface CalendarProps {
  uid: string
  ledger: Ledger
  todayKey: string
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/** Enough to land on today with a little scroll-back context already loaded. */
const INITIAL_HISTORY_MONTHS = 3
/** How many additional months to bring in each time the user scrolls near the top. */
const HISTORY_BATCH_MONTHS = 3

function buildDayAriaLabel(view: CalendarDayView, labels: StateLabels): string {
  const parts = [formatDisplayDate(view.dateKey)]
  if (view.effectiveState) parts.push(labels[view.effectiveState])
  if (view.isToday) parts.push('Today')
  if (view.hasNote) parts.push('has a note')
  if (view.count) parts.push(formatCount(view.count))
  return parts.join(', ')
}

export function Calendar({ uid, ledger, todayKey }: CalendarProps) {
  const todayYearMonth = yearMonthFromDateKey(todayKey)
  const startYearMonth = yearMonthFromDateKey(ledger.startDate)
  // Inclusive count of months from the ledger's start through today's month.
  const totalAvailableMonths = Math.max(1, compareYearMonth(todayYearMonth, startYearMonth) + 1)

  const [historyMonths, setHistoryMonths] = useState(() =>
    Math.min(INITIAL_HISTORY_MONTHS, totalAvailableMonths),
  )
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)

  const months = generateRollingMonths(todayYearMonth, historyMonths)
  const hasMoreHistory = historyMonths < totalAvailableMonths
  const labels = resolveStateLabels(ledger.stateLabels)

  const { startKey } = monthKeyRange(months[0])
  const { endKey } = monthKeyRange(todayYearMonth)
  const { records, error } = useRangeRecords(uid, ledger.id, startKey, endKey)

  const scrollRef = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLButtonElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  // Set right before widening history so the compensation effect below
  // knows how much height was just added above the current scroll position.
  const pendingHistoryScrollHeightRef = useRef<number | null>(null)

  // Land the sheet on today, with recent history already visible above it,
  // once, when it first opens -- not pinned to the very top of everything.
  useLayoutEffect(() => {
    todayRef.current?.scrollIntoView({ block: 'center' })
    // Deliberately run once on mount only; later history/records changes
    // must not re-trigger this and yank the user's scroll position.
  }, [])

  // Prepending earlier months shifts everything below them down by the
  // height just added; hold the viewport steady by scrolling by that same
  // amount so the content the user was looking at doesn't jump.
  useLayoutEffect(() => {
    const container = scrollRef.current
    const previousScrollHeight = pendingHistoryScrollHeightRef.current
    if (container && previousScrollHeight !== null) {
      container.scrollTop += container.scrollHeight - previousScrollHeight
      pendingHistoryScrollHeightRef.current = null
    }
  }, [historyMonths])

  useEffect(() => {
    if (!hasMoreHistory) return
    const sentinel = sentinelRef.current
    const root = scrollRef.current
    if (!sentinel || !root) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        pendingHistoryScrollHeightRef.current = root.scrollHeight
        setHistoryMonths((count) => Math.min(count + HISTORY_BATCH_MONTHS, totalAvailableMonths))
      },
      { root, rootMargin: '200px 0px 0px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMoreHistory, totalAvailableMonths])

  async function handleDetailSave(dateKey: string, normalized: NormalizedDailyRecord) {
    await saveDailyRecord(uid, ledger.id, dateKey, normalized)
  }

  // CalendarSheet is a sibling of Home's .home-main, not a descendant, so
  // it can't inherit --ledger-accent from there -- this is its own supply
  // of the same ledger accent, tying the calendar visibly to whichever
  // ledger it's showing rather than reading as a neutral detached tool.
  const ledgerAccent = { '--ledger-accent': `var(--ledger-color-${resolveLedgerColor(ledger.color)})` } as CSSProperties

  return (
    <section className="calendar" style={ledgerAccent}>
      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      {error ? (
        <p role="alert" className="message">
          {error}
        </p>
      ) : (
        <div className="calendar-scroll" ref={scrollRef}>
          {hasMoreHistory && (
            <div ref={sentinelRef} className="calendar-history-sentinel" aria-hidden="true" />
          )}
          {months.map((yearMonth) => (
            <MonthSection
              key={`${yearMonth.year}-${yearMonth.month}`}
              yearMonth={yearMonth}
              ledger={ledger}
              todayKey={todayKey}
              records={records}
              labels={labels}
              todayRef={todayRef}
              onSelect={setSelectedDateKey}
            />
          ))}
        </div>
      )}

      {selectedDateKey && (
        <DayDetail
          dateKey={selectedDateKey}
          defaultState={ledger.defaultState}
          initialRecord={records.get(selectedDateKey) ?? {}}
          labels={labels}
          onSave={(normalized) => handleDetailSave(selectedDateKey, normalized)}
          onDismiss={() => setSelectedDateKey(null)}
        />
      )}
    </section>
  )
}

interface MonthSectionProps {
  yearMonth: YearMonth
  ledger: Ledger
  todayKey: string
  records: MonthRecords
  labels: StateLabels
  todayRef: RefObject<HTMLButtonElement | null>
  onSelect: (dateKey: string) => void
}

function MonthSection({
  yearMonth,
  ledger,
  todayKey,
  records,
  labels,
  todayRef,
  onSelect,
}: MonthSectionProps) {
  const calendarMonth = getCalendarMonth(yearMonth.year, yearMonth.month)

  return (
    <div className="calendar-month-section">
      <h3 className="calendar-month-heading">{formatMonthLabel(yearMonth)}</h3>
      <div className="calendar-grid">
        {Array.from({ length: calendarMonth.leadingBlanks }, (_, index) => (
          <div
            key={`blank-${index}`}
            className="calendar-cell calendar-cell-blank"
            aria-hidden="true"
          />
        ))}

        {calendarMonth.days.map((cell) => {
          const view = resolveCalendarDayView({
            dateKey: cell.dateKey,
            dayOfMonth: cell.dayOfMonth,
            todayKey,
            startDate: ledger.startDate,
            defaultState: ledger.defaultState,
            record: records.get(cell.dateKey),
          })
          return (
            <CalendarDayCell
              key={cell.dateKey}
              view={view}
              labels={labels}
              onSelect={onSelect}
              todayRef={todayRef}
            />
          )
        })}
      </div>
    </div>
  )
}

interface CalendarDayCellProps {
  view: CalendarDayView
  labels: StateLabels
  onSelect: (dateKey: string) => void
  todayRef: RefObject<HTMLButtonElement | null>
}

function CalendarDayCell({ view, labels, onSelect, todayRef }: CalendarDayCellProps) {
  if (view.status !== 'active') {
    return (
      <div className="calendar-cell calendar-cell-inactive" aria-hidden="true">
        <span className="calendar-cell-day">{view.dayOfMonth}</span>
      </div>
    )
  }

  const className = [
    'calendar-cell',
    view.isToday && 'calendar-cell-today',
    !view.isDefault && 'calendar-cell-marked',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      ref={view.isToday ? todayRef : undefined}
      type="button"
      className={className}
      onClick={() => onSelect(view.dateKey)}
      aria-label={buildDayAriaLabel(view, labels)}
      aria-current={view.isToday ? 'date' : undefined}
    >
      <span className="calendar-cell-day">{view.dayOfMonth}</span>
      {view.hasNote && <span className="calendar-cell-note-dot" aria-hidden="true" />}
      {view.count && <span className="calendar-cell-count">{formatCount(view.count)}</span>}
    </button>
  )
}
