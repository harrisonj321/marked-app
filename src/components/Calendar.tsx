import { useState } from 'react'
import {
  addMonths,
  compareYearMonth,
  formatMonthLabel,
  getCalendarMonth,
  resolveCalendarDayView,
  yearMonthFromDateKey,
  type CalendarDayView,
  type YearMonth,
} from '../domain/calendar'
import { formatDisplayDate } from '../domain/date'
import { formatCount, type NormalizedDailyRecord } from '../domain/day'
import { resolveStateLabels, type StateLabels, type TrackerConfig } from '../domain/tracker'
import { saveDailyRecord } from '../data/day'
import { useMonthRecords } from '../hooks/useMonthRecords'
import { DayDetail } from './DayDetail'

interface CalendarProps {
  uid: string
  tracker: TrackerConfig
  todayKey: string
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function buildDayAriaLabel(view: CalendarDayView, labels: StateLabels): string {
  const parts = [formatDisplayDate(view.dateKey)]
  if (view.effectiveState) parts.push(labels[view.effectiveState])
  if (view.isToday) parts.push('Today')
  if (view.hasNote) parts.push('has a note')
  if (view.count) parts.push(formatCount(view.count))
  return parts.join(', ')
}

export function Calendar({ uid, tracker, todayKey }: CalendarProps) {
  const todayYearMonth = yearMonthFromDateKey(todayKey)
  const [visibleMonth, setVisibleMonth] = useState<YearMonth>(todayYearMonth)
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)

  const { records, error } = useMonthRecords(uid, visibleMonth)
  const calendarMonth = getCalendarMonth(visibleMonth.year, visibleMonth.month)
  const canGoNext = compareYearMonth(visibleMonth, todayYearMonth) < 0
  const labels = resolveStateLabels(tracker.stateLabels)

  function goToPreviousMonth() {
    setVisibleMonth((current) => addMonths(current, -1))
  }

  function goToNextMonth() {
    if (canGoNext) {
      setVisibleMonth((current) => addMonths(current, 1))
    }
  }

  async function handleDetailSave(dateKey: string, normalized: NormalizedDailyRecord) {
    await saveDailyRecord(uid, dateKey, normalized)
  }

  return (
    <section className="calendar">
      <div className="calendar-nav">
        <button type="button" onClick={goToPreviousMonth} aria-label="Previous month">
          &larr;
        </button>
        <p className="calendar-month-label">{formatMonthLabel(visibleMonth)}</p>
        <button
          type="button"
          onClick={goToNextMonth}
          disabled={!canGoNext}
          aria-label="Next month"
        >
          &rarr;
        </button>
      </div>

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
              startDate: tracker.startDate,
              defaultState: tracker.defaultState,
              record: records.get(cell.dateKey),
            })
            return (
              <CalendarDayCell
                key={cell.dateKey}
                view={view}
                labels={labels}
                onSelect={setSelectedDateKey}
              />
            )
          })}
        </div>
      )}

      {selectedDateKey && (
        <DayDetail
          dateKey={selectedDateKey}
          defaultState={tracker.defaultState}
          initialRecord={records.get(selectedDateKey) ?? {}}
          labels={labels}
          onSave={(normalized) => handleDetailSave(selectedDateKey, normalized)}
          onDismiss={() => setSelectedDateKey(null)}
        />
      )}
    </section>
  )
}

interface CalendarDayCellProps {
  view: CalendarDayView
  labels: StateLabels
  onSelect: (dateKey: string) => void
}

function CalendarDayCell({ view, labels, onSelect }: CalendarDayCellProps) {
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
