import { useEffect, useState } from 'react'
import { STATE_LABEL_MAX_LENGTH } from '../domain/tracker'

/**
 * Synchronized example pairs shown as cycling placeholders, purely to
 * demonstrate that Noted. can represent many different binaries -- never
 * treated as a canonical pair, a stored value, or a default selection.
 */
const PLACEHOLDER_PAIRS: ReadonlyArray<{ defaultState: string; notedState: string }> = [
  { defaultState: 'No', notedState: 'Yes' },
  { defaultState: 'Rough', notedState: 'Good' },
  { defaultState: 'Low', notedState: 'High' },
  { defaultState: 'Absent', notedState: 'Present' },
]

const CYCLE_INTERVAL_MS = 2600

interface StateLabelFieldsProps {
  defaultLabelId: string
  notedLabelId: string
  defaultValue: string
  notedValue: string
  onDefaultChange: (value: string) => void
  onNotedChange: (value: string) => void
  defaultError: string | null
  notedError: string | null
}

/**
 * The two state-label fields for ledger creation. Cycling-placeholder state
 * lives entirely in this component, not the surrounding sheet, so the
 * interval tick that advances the example pair never re-renders the ledger
 * list or the rest of the form around it.
 */
export function StateLabelFields({
  defaultLabelId,
  notedLabelId,
  defaultValue,
  notedValue,
  onDefaultChange,
  onNotedChange,
  defaultError,
  notedError,
}: StateLabelFieldsProps) {
  const [pairIndex, setPairIndex] = useState(0)
  const [focusedField, setFocusedField] = useState<'default' | 'noted' | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    const interval = setInterval(() => {
      setPairIndex((index) => (index + 1) % PLACEHOLDER_PAIRS.length)
    }, CYCLE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const pair = PLACEHOLDER_PAIRS[pairIndex]

  return (
    <>
      <div className="field">
        <label htmlFor={defaultLabelId}>Default state</label>
        <p className="field-hint">If I don't log anything, count the day as:</p>
        <input
          id={defaultLabelId}
          type="text"
          value={defaultValue}
          placeholder={focusedField === 'default' ? '' : pair.defaultState}
          onChange={(event) => onDefaultChange(event.target.value)}
          onFocus={() => setFocusedField('default')}
          onBlur={() => setFocusedField((current) => (current === 'default' ? null : current))}
          maxLength={STATE_LABEL_MAX_LENGTH}
          autoComplete="off"
        />
        {defaultError && (
          <p role="alert" className="message">
            {defaultError}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={notedLabelId}>Noted state</label>
        <input
          id={notedLabelId}
          type="text"
          value={notedValue}
          placeholder={focusedField === 'noted' ? '' : pair.notedState}
          onChange={(event) => onNotedChange(event.target.value)}
          onFocus={() => setFocusedField('noted')}
          onBlur={() => setFocusedField((current) => (current === 'noted' ? null : current))}
          maxLength={STATE_LABEL_MAX_LENGTH}
          autoComplete="off"
        />
        {notedError && (
          <p role="alert" className="message">
            {notedError}
          </p>
        )}
      </div>
    </>
  )
}
