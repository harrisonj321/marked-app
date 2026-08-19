import { useId, useState, type FormEvent } from 'react'
import { LEDGER_NAME_SUGGESTIONS } from '../domain/ledgerSuggestions'
import { TRACKER_NAME_MAX_LENGTH, validateTrackerName, type DayState } from '../domain/tracker'

interface SetupProps {
  onComplete: (input: { name: string; defaultState: DayState }) => Promise<void>
}

/**
 * First-ledger creation. Opens on a small set of example uses (see
 * LEDGER_NAME_SUGGESTIONS) so a first-time user isn't handed a blank field
 * and asked to invent a ledger from nothing -- picking one only seeds the
 * name below; it is not a template and carries no other behavior. "Something
 * else" skips straight to the same blank form a returning-to-this-step user
 * would see. Either way the rest of the flow -- name, default-day meaning --
 * is the one existing form, unchanged.
 */
export function Setup({ onComplete }: SetupProps) {
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [name, setName] = useState('')
  const [defaultState, setDefaultState] = useState<DayState | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const nameId = useId()

  if (showSuggestions) {
    return (
      <main className="screen">
        <h1>Noted.</h1>
        <p className="message">What could you track?</p>
        <div className="suggestion-grid">
          {LEDGER_NAME_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="suggestion-chip"
              onClick={() => {
                setName(suggestion)
                setShowSuggestions(false)
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
        <button type="button" className="footer-link" onClick={() => setShowSuggestions(false)}>
          Something else
        </button>
      </main>
    )
  }

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
          autoFocus={name === ''}
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
        <p className="message">You can rename these, or pick other words entirely, anytime.</p>

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
