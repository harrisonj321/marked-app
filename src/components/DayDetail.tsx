import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { formatDisplayDate } from '../domain/date'
import {
  NOTE_MAX_LENGTH,
  modeForCount,
  normalizeDailyRecord,
  validateNote,
  validateOtherCount,
  type CountMode,
  type CountValidation,
  type DailyRecord,
  type NormalizedDailyRecord,
} from '../domain/day'
import { DEFAULT_STATE_LABELS, type DayState, type StateLabels } from '../domain/tracker'
import { CountSelector } from './CountSelector'
import { CloseIcon } from './icons'

interface DayDetailProps {
  dateKey: string
  defaultState: DayState
  initialRecord: DailyRecord
  /** False for today's note sheet: the home screen already owns today's state. */
  editableState?: boolean
  labels?: StateLabels
  onSave: (normalized: NormalizedDailyRecord) => Promise<void>
  onDismiss: () => void
}

export function DayDetail({
  dateKey,
  defaultState,
  initialRecord,
  editableState = true,
  labels = DEFAULT_STATE_LABELS,
  onSave,
  onDismiss,
}: DayDetailProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [effectiveState, setEffectiveState] = useState<DayState>(
    initialRecord.state ?? defaultState,
  )
  const [noteDraft, setNoteDraft] = useState(initialRecord.note ?? '')
  const initialCountMode = modeForCount(initialRecord.count)
  const [countMode, setCountMode] = useState<CountMode>(initialCountMode)
  const [otherCountDraft, setOtherCountDraft] = useState(
    initialCountMode === 'other' && initialRecord.count ? String(initialRecord.count) : '',
  )
  const [noteError, setNoteError] = useState<string | null>(null)
  const [countError, setCountError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const titleId = useId()
  const noteId = useId()
  const otherCountId = useId()

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close()
    }
  }

  function handleCountSelect(nextMode: CountMode) {
    setCountMode(nextMode)
    setCountError(null)
    if (nextMode !== 'other') {
      setOtherCountDraft('')
    }
  }

  function resolveCount(): CountValidation {
    if (countMode === 'two') return { valid: true, count: 2 }
    if (countMode === 'three') return { valid: true, count: 3 }
    if (countMode === 'other') return validateOtherCount(otherCountDraft)
    return { valid: true, count: undefined }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const noteResult = validateNote(noteDraft)
    const countResult: CountValidation =
      effectiveState === 'did' ? resolveCount() : { valid: true, count: undefined }

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
      <div className="day-detail-header">
        <h2 id={titleId}>{formatDisplayDate(dateKey)}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
        >
          <CloseIcon />
        </button>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        {editableState && (
          <fieldset>
            <legend className="visually-hidden">State</legend>
            <label>
              <input
                type="radio"
                name={`${titleId}-state`}
                checked={effectiveState === 'did'}
                onChange={() => setEffectiveState('did')}
              />
              {labels.did}
            </label>
            <label>
              <input
                type="radio"
                name={`${titleId}-state`}
                checked={effectiveState === 'didnt'}
                onChange={() => setEffectiveState('didnt')}
              />
              {labels.didnt}
            </label>
          </fieldset>
        )}

        {effectiveState === 'did' && (
          <CountSelector
            mode={countMode}
            otherDraft={otherCountDraft}
            otherError={countError}
            onSelect={handleCountSelect}
            onOtherDraftChange={setOtherCountDraft}
            otherInputId={otherCountId}
          />
        )}

        <div className="field">
          <label htmlFor={noteId}>Note</label>
          <textarea
            id={noteId}
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            maxLength={NOTE_MAX_LENGTH}
            rows={2}
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
        </div>
      </form>
    </dialog>
  )
}
