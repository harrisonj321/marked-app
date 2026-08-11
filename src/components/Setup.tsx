import { useId, useState, type FormEvent } from 'react'
import { TRACKER_NAME_MAX_LENGTH, validateTrackerName, type DayState } from '../domain/tracker'

interface SetupProps {
  onComplete: (input: { name: string; defaultState: DayState }) => Promise<void>
}

export function Setup({ onComplete }: SetupProps) {
  const [name, setName] = useState('')
  const [defaultState, setDefaultState] = useState<DayState | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const nameId = useId()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const validation = validateTrackerName(name)
    if (!validation.valid) {
      setNameError(validation.error)
      return
    }

    if (!defaultState) {
      setNameError(null)
      setFormError("Choose what an untouched day means.")
      return
    }

    setNameError(null)
    setFormError(null)
    setSubmitting(true)

    try {
      await onComplete({ name: validation.name, defaultState })
    } catch {
      setFormError('Could not save. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <main className="screen">
      <h1>Noted.</h1>
      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <label htmlFor={nameId}>What are you tracking?</label>
        <input
          id={nameId}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={TRACKER_NAME_MAX_LENGTH}
          autoComplete="off"
        />
        {nameError && (
          <p role="alert" className="message">
            {nameError}
          </p>
        )}

        <fieldset>
          <legend>If I don't log anything, count the day as:</legend>
          <label>
            <input
              type="radio"
              name="defaultState"
              value="did"
              checked={defaultState === 'did'}
              onChange={() => setDefaultState('did')}
            />
            I did it
          </label>
          <label>
            <input
              type="radio"
              name="defaultState"
              value="didnt"
              checked={defaultState === 'didnt'}
              onChange={() => setDefaultState('didnt')}
            />
            I didn't do it
          </label>
        </fieldset>

        {formError && (
          <p role="alert" className="message">
            {formError}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          Save
        </button>
      </form>
    </main>
  )
}
