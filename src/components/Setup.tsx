import { useState, type FormEvent } from 'react'
import { LEDGER_NAME_SUGGESTIONS } from '../domain/ledgerSuggestions'
import { validateTrackerName, type DayState } from '../domain/tracker'
import { LedgerBasicsFields } from './LedgerBasicsFields'

interface SetupProps {
  onComplete: (input: { name: string; defaultState: DayState }) => Promise<void>
}

/**
 * First-ledger creation: the exact same name+default-state fields
 * LedgerSwitcherSheet uses for every later ledger (see LedgerBasicsFields),
 * so a first-time user lands in the real ledger-creation UI rather than a
 * separate onboarding-flavored screen. The only addition is a collapsed
 * suggestions disclosure under the name field -- picking one only seeds the
 * name, exactly as if the user had typed it; it is not a template and
 * carries no other behavior.
 */
export function Setup({ onComplete }: SetupProps) {
  const [name, setName] = useState('')
  const [defaultState, setDefaultState] = useState<DayState | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

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

  function selectSuggestion(suggestion: string) {
    setName(suggestion)
    setNameError(null)
    setSuggestionsOpen(false)
  }

  return (
    <main className="screen">
      <h1>Noted.</h1>
      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <LedgerBasicsFields
          name={name}
          onNameChange={setName}
          nameError={nameError}
          nameAutoFocus
          defaultState={defaultState}
          onDefaultStateChange={setDefaultState}
          afterName={
            <div className="ledger-suggestions">
              <button
                type="button"
                className="footer-link ledger-suggestions-toggle"
                aria-expanded={suggestionsOpen}
                onClick={() => setSuggestionsOpen((open) => !open)}
              >
                Not sure what to note? Try one of these.
              </button>
              {suggestionsOpen && (
                <div className="suggestion-grid">
                  {LEDGER_NAME_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="suggestion-chip"
                      onClick={() => selectSuggestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          }
          afterFieldset={
            <p className="field-hint">
              You can rename these, or pick other words entirely, anytime.
            </p>
          }
        />

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
