import { useState } from 'react'
import type { NormalizedDailyRecord } from '../domain/day'
import { DEFAULT_STATE_LABELS, type DayState, type StateLabels } from '../domain/tracker'
import { saveDailyRecord } from '../data/day'
import { useTodayState } from '../hooks/useTodayState'
import { DayDetail } from './DayDetail'
import { TodayToggle } from './TodayToggle'

interface TodaySectionProps {
  uid: string
  ledgerId: string
  defaultState: DayState
  timezone: string
  labels?: StateLabels
  accentColor?: string
}

export function TodaySection({
  uid,
  ledgerId,
  defaultState,
  timezone,
  labels = DEFAULT_STATE_LABELS,
  accentColor,
}: TodaySectionProps) {
  const today = useTodayState(uid, ledgerId, defaultState, timezone)
  const [detailOpen, setDetailOpen] = useState(false)
  const hasNote = Boolean(today.record.note)

  async function handleDetailSave(normalized: NormalizedDailyRecord) {
    await saveDailyRecord(uid, ledgerId, today.dateKey, normalized)
  }

  return (
    <section className="today">
      {today.effectiveState && (
        <>
          <TodayToggle
            state={today.effectiveState}
            defaultState={defaultState}
            onSelect={today.setState}
            labels={labels}
            accentColor={accentColor}
          />
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
          labels={labels}
          onSave={handleDetailSave}
          onDismiss={() => setDetailOpen(false)}
        />
      )}
    </section>
  )
}
