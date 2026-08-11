import { useState } from 'react'
import type { NormalizedDailyRecord } from '../domain/day'
import { oppositeState, type DayState } from '../domain/tracker'
import { saveDailyRecord } from '../data/day'
import { useTodayState } from '../hooks/useTodayState'
import { DayDetail } from './DayDetail'

interface TodaySectionProps {
  uid: string
  defaultState: DayState
  timezone: string
}

const STATE_LABEL = { did: 'Did', didnt: "Didn't" } as const

export function TodaySection({ uid, defaultState, timezone }: TodaySectionProps) {
  const today = useTodayState(uid, defaultState, timezone)
  const [detailOpen, setDetailOpen] = useState(false)
  const next = today.effectiveState ? oppositeState(today.effectiveState) : null
  const hasNote = Boolean(today.record.note)

  async function handleDetailSave(normalized: NormalizedDailyRecord) {
    await saveDailyRecord(uid, today.dateKey, normalized)
  }

  return (
    <section className="today">
      {today.effectiveState && next && (
        <>
          <p className="today-state" aria-live="polite">
            {STATE_LABEL[today.effectiveState]}
          </p>
          <button
            type="button"
            onClick={today.toggle}
            className="today-action"
            aria-label={`Mark today as "${STATE_LABEL[next]}"`}
          >
            {STATE_LABEL[next]}
          </button>
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
