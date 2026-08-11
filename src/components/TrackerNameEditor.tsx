import { useId, useState, type FormEvent } from 'react'
import { TRACKER_NAME_MAX_LENGTH, validateTrackerName } from '../domain/tracker'

interface TrackerNameEditorProps {
  name: string
  onSave: (name: string) => Promise<void>
}

export function TrackerNameEditor({ name, onSave }: TrackerNameEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inputId = useId()

  function startEditing() {
    setDraft(name)
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
    setError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const validation = validateTrackerName(draft)
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    if (validation.name === name) {
      setEditing(false)
      return
    }

    setError(null)
    setSaving(true)
    try {
      await onSave(validation.name)
      setEditing(false)
    } catch {
      setError('Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="tracker-title">
        <h1 className="tracker-title-name">{name}</h1>
        <button
          type="button"
          onClick={startEditing}
          aria-label="Edit tracker name"
          className="tracker-title-edit"
        >
          Edit
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="tracker-name-edit"
      noValidate
    >
      <label htmlFor={inputId} className="visually-hidden">
        Tracker name
      </label>
      <input
        id={inputId}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={TRACKER_NAME_MAX_LENGTH}
        autoFocus
      />
      {error && (
        <p role="alert" className="message">
          {error}
        </p>
      )}
      <div className="tracker-name-actions">
        <button type="submit" disabled={saving}>
          Save
        </button>
        <button type="button" onClick={cancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
