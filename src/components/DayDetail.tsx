import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { formatDisplayDate } from '../domain/date'
import {
  COUNT_MAX,
  COUNT_MIN,
  NOTE_MAX_LENGTH,
  normalizeDailyRecord,
  validateCount,
  validateNote,
  type DailyRecord,
  type NormalizedDailyRecord,
} from '../domain/day'
import type { DayState } from '../domain/tracker'

interface DayDetailProps {
  dateKey: string
  defaultState: DayState
  initialRecord: DailyRecord
  onSave: (normalized: NormalizedDailyRecord) => Promise<void>
  onDismiss: () => void
}

const STATE_LABEL = { did: 'Did', didnt: "Didn't" } as const

export function DayDetail({ dateKey, defaultState, initialRecord, onSave, onDismiss }: DayDetailProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [effectiveState, setEffectiveState] = useState<DayState>(
    initialRecord.state ?? defaultState,
  )
  const [noteDraft, setNoteDraft] = useState(initialRecord.note ?? '')
  const [countDraft, setCountDraft] = useState(
    initialRecord.count ? String(initialRecord.count) : '',
  )
  const [noteError, setNoteError] = useState<string | null>(null)
  const [countError, setCountError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const titleId = useId()
  const noteId = useId()
  const countId = useId()

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close()
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const noteResult = validateNote(noteDraft)
    const countResult = effectiveState === 'did' ? validateCount(countDraft) : { valid: true as const, count: undefined }

    setNoteError(noteResult.valid ? null : noteResult.error)
    setCountError(countResult.valid ? null : countResult.error)

    if (!noteResult.valid || !countResult.valid) {
      return
    }

    setFormError(null)
    setSaving(true)
    try {
      const normalized = normalizeDailyRecord({
        defaultState,
        effectiveState,
        note: noteResult.note,
        count: countResult.count,
      })
      await onSave(normalized)
      dialogRef.current?.close()
    } catch {
      setFormError('Could not save. Try again.')
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="day-detail"
      aria-labelledby={titleId}
      onClose={onDismiss}
      onClick={handleBackdropClick}
    >
      <h2 id={titleId}>{formatDisplayDate(dateKey)}</h2>

      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <fieldset>
          <legend className="visually-hidden">State</legend>
          <label>
            <input
              type="radio"
              name={`${titleId}-state`}
              checked={effectiveState === 'did'}
              onChange={() => setEffectiveState('did')}
            />
            {STATE_LABEL.did}
          </label>
          <label>
            <input
              type="radio"
              name={`${titleId}-state`}
              checked={effectiveState === 'didnt'}
              onChange={() => setEffectiveState('didnt')}
            />
            {STATE_LABEL.didnt}
          </label>
        </fieldset>

        {effectiveState === 'did' && (
          <div className="field">
            <label htmlFor={countId}>Count</label>
            <input
              id={countId}
              type="number"
              inputMode="numeric"
              min={COUNT_MIN}
              max={COUNT_MAX}
              placeholder="1"
              value={countDraft}
              onChange={(event) => setCountDraft(event.target.value)}
            />
            {countError && (
              <p role="alert" className="message">
                {countError}
              </p>
            )}
          </div>
        )}

        <div className="field">
          <label htmlFor={noteId}>Add note</label>
          <input
            id={noteId}
            type="text"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            maxLength={NOTE_MAX_LENGTH}
          />
          {noteError && (
            <p role="alert" className="message">
              {noteError}
            </p>
          )}
        </div>

        {formError && (
          <p role="alert" className="message">
            {formError}
          </p>
        )}

        <div className="day-detail-actions">
          <button type="submit" disabled={saving}>
            Save
          </button>
          <button type="button" onClick={() => dialogRef.current?.close()} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
