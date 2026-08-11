import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import type { DayState } from '../domain/tracker'
import { CloseIcon } from './icons'

interface SettingsSheetProps {
  defaultState: DayState
  onSaveDefaultState: (defaultState: DayState) => Promise<void>
  onDismiss: () => void
}

export function SettingsSheet({ defaultState, onSaveDefaultState, onDismiss }: SettingsSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<DayState>(defaultState)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const titleId = useId()

  // The tracker is live, so the stored default can change under an open
  // sheet (another device). Re-sync during render rather than in an
  // effect, so the selection always shows what is actually stored and an
  // untouched form can never save a stale value back.
  const [syncedDefault, setSyncedDefault] = useState(defaultState)
  if (defaultState !== syncedDefault) {
    setSyncedDefault(defaultState)
    setDraft(defaultState)
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

    if (draft === defaultState) {
      dialogRef.current?.close()
      return
    }

    setError(null)
    setSaving(true)
    try {
      await onSaveDefaultState(draft)
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
            Did
          </label>
          <label>
            <input
              type="radio"
              name={`${titleId}-default`}
              value="didnt"
              checked={draft === 'didnt'}
              onChange={() => setDraft('didnt')}
            />
            Didn&#39;t
          </label>
        </fieldset>

        <p className="message">
          Days you have marked keep what they say. Days you have not follow this setting.
        </p>

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
