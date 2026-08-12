import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import {
  STATE_LABEL_MAX_LENGTH,
  validateStateLabel,
  type DayState,
  type StateLabels,
} from '../domain/tracker'
import { CloseIcon } from './icons'

interface SettingsSheetProps {
  defaultState: DayState
  stateLabels: StateLabels
  onSaveDefaultState: (defaultState: DayState) => Promise<void>
  onSaveStateLabels: (stateLabels: StateLabels) => Promise<void>
  onDismiss: () => void
}

export function SettingsSheet({
  defaultState,
  stateLabels,
  onSaveDefaultState,
  onSaveStateLabels,
  onDismiss,
}: SettingsSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<DayState>(defaultState)
  const [didLabelDraft, setDidLabelDraft] = useState(stateLabels.did)
  const [didntLabelDraft, setDidntLabelDraft] = useState(stateLabels.didnt)
  const [didLabelError, setDidLabelError] = useState<string | null>(null)
  const [didntLabelError, setDidntLabelError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const titleId = useId()
  const didLabelId = useId()
  const didntLabelId = useId()

  // The tracker is live, so the stored default and labels can change under
  // an open sheet (another device). Re-sync during render rather than in
  // an effect, so the form always shows what is actually stored and an
  // untouched field can never save a stale value back.
  const [syncedDefault, setSyncedDefault] = useState(defaultState)
  if (defaultState !== syncedDefault) {
    setSyncedDefault(defaultState)
    setDraft(defaultState)
  }

  const [syncedLabels, setSyncedLabels] = useState(stateLabels)
  if (stateLabels.did !== syncedLabels.did || stateLabels.didnt !== syncedLabels.didnt) {
    setSyncedLabels(stateLabels)
    setDidLabelDraft(stateLabels.did)
    setDidntLabelDraft(stateLabels.didnt)
  }

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

    const didValidation = validateStateLabel(didLabelDraft)
    const didntValidation = validateStateLabel(didntLabelDraft)

    setDidLabelError(didValidation.valid ? null : didValidation.error)
    setDidntLabelError(didntValidation.valid ? null : didntValidation.error)

    if (!didValidation.valid || !didntValidation.valid) {
      return
    }

    const defaultStateChanged = draft !== defaultState
    const labelsChanged =
      didValidation.label !== syncedLabels.did || didntValidation.label !== syncedLabels.didnt

    if (!defaultStateChanged && !labelsChanged) {
      dialogRef.current?.close()
      return
    }

    setError(null)
    setSaving(true)
    try {
      if (defaultStateChanged) {
        await onSaveDefaultState(draft)
      }
      if (labelsChanged) {
        await onSaveStateLabels({ did: didValidation.label, didnt: didntValidation.label })
      }
      dialogRef.current?.close()
    } catch {
      setError('Could not save. Try again.')
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="settings-sheet"
      aria-labelledby={titleId}
      onClose={onDismiss}
      onClick={handleBackdropClick}
    >
      <div className="settings-sheet-header">
        <h2 id={titleId}>Settings</h2>
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
        <fieldset>
          <legend>An untouched day counts as:</legend>
          <label>
            <input
              type="radio"
              name={`${titleId}-default`}
              value="did"
              checked={draft === 'did'}
              onChange={() => setDraft('did')}
            />
            {syncedLabels.did}
          </label>
          <label>
            <input
              type="radio"
              name={`${titleId}-default`}
              value="didnt"
              checked={draft === 'didnt'}
              onChange={() => setDraft('didnt')}
            />
            {syncedLabels.didnt}
          </label>
        </fieldset>

        <p className="message">
          Days you have marked keep what they say. Days you have not follow this setting.
        </p>

        <fieldset>
          <legend>Labels</legend>
          <div className="field">
            <label htmlFor={didLabelId}>First option</label>
            <input
              id={didLabelId}
              type="text"
              value={didLabelDraft}
              onChange={(event) => setDidLabelDraft(event.target.value)}
              maxLength={STATE_LABEL_MAX_LENGTH}
            />
            {didLabelError && (
              <p role="alert" className="message">
                {didLabelError}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor={didntLabelId}>Second option</label>
            <input
              id={didntLabelId}
              type="text"
              value={didntLabelDraft}
              onChange={(event) => setDidntLabelDraft(event.target.value)}
              maxLength={STATE_LABEL_MAX_LENGTH}
            />
            {didntLabelError && (
              <p role="alert" className="message">
                {didntLabelError}
              </p>
            )}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="message">
            {error}
          </p>
        )}

        <div className="settings-actions">
          <button type="submit" disabled={saving}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  )
}
