import { useState } from 'react'
import type { NormalizedDailyRecord } from '../domain/day'
import type { DayState } from '../domain/tracker'
import { saveDailyRecord } from '../data/day'
import { useTodayState } from '../hooks/useTodayState'
import { DayDetail } from './DayDetail'
import { TodayToggle } from './TodayToggle'

interface TodaySectionProps {
  uid: string
  defaultState: DayState
  timezone: string
}

export function TodaySection({ uid, defaultState, timezone }: TodaySectionProps) {
  const today = useTodayState(uid, defaultState, timezone)
  const [detailOpen, setDetailOpen] = useState(false)
  const hasNote = Boolean(today.record.note)

  async function handleDetailSave(normalized: NormalizedDailyRecord) {
    await saveDailyRecord(uid, today.dateKey, normalized)
  }

  return (
    <section className="today">
      {today.effectiveState && (
        <>
          <TodayToggle state={today.effectiveState} onSelect={today.setState} />
          {today.pending && (
            <p className="message" aria-live="polite">
              Saving&hellip;
            </p>
          )}
          {today.error && (
            <p role="alert" className="message">
              {today.error}
            </p>
          )}
          <button
            type="button"
            className="today-detail-link"
            onClick={() => setDetailOpen(true)}
          >
            {hasNote ? 'Edit note' : 'Add note'}
          </button>
        </>
      )}

      {detailOpen && (
        <DayDetail
          dateKey={today.dateKey}
          defaultState={defaultState}
          initialRecord={today.record}
          editableState={false}
          onSave={handleDetailSave}
          onDismiss={() => setDetailOpen(false)}
        />
      )}
    </section>
  )
}
