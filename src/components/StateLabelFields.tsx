import { useEffect, useState } from 'react'
import { STATE_LABEL_MAX_LENGTH } from '../domain/tracker'

/**
 * Synchronized example pairs shown as cycling placeholders, purely to
 * demonstrate that Marked. can represent many different binaries -- never
 * treated as a canonical pair, a stored value, or a default selection.
 */
const PLACEHOLDER_PAIRS: ReadonlyArray<{ defaultState: string; markedState: string }> = [
  { defaultState: 'No', markedState: 'Yes' },
  { defaultState: 'Rough', markedState: 'Good' },
  { defaultState: 'Low', markedState: 'High' },
  { defaultState: 'Absent', markedState: 'Present' },
]

const CYCLE_INTERVAL_MS = 2600

interface StateLabelFieldsProps {
  defaultLabelId: string
  markedLabelId: string
  defaultValue: string
  markedValue: string
  onDefaultChange: (value: string) => void
  onMarkedChange: (value: string) => void
  defaultError: string | null
  markedError: string | null
}

/**
 * The two state-label fields for ledger creation. Cycling-placeholder state
 * lives entirely in this component, not the surrounding sheet, so the
 * interval tick that advances the example pair never re-renders the ledger
 * list or the rest of the form around it.
 */
export function StateLabelFields({
  defaultLabelId,
  markedLabelId,
  defaultValue,
  markedValue,
  onDefaultChange,
  onMarkedChange,
  defaultError,
  markedError,
}: StateLabelFieldsProps) {
  const [pairIndex, setPairIndex] = useState(0)
  const [focusedField, setFocusedField] = useState<'default' | 'marked' | null>(null)

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
        <label htmlFor={markedLabelId}>Marked state</label>
        <input
          id={markedLabelId}
          type="text"
          value={markedValue}
          placeholder={focusedField === 'marked' ? '' : pair.markedState}
          onChange={(event) => onMarkedChange(event.target.value)}
          onFocus={() => setFocusedField('marked')}
          onBlur={() => setFocusedField((current) => (current === 'marked' ? null : current))}
          maxLength={STATE_LABEL_MAX_LENGTH}
          autoComplete="off"
        />
        {markedError && (
          <p role="alert" className="message">
            {markedError}
          </p>
        )}
      </div>
    </>
  )
}
