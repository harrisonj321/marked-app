import { useId, type ReactNode } from 'react'
import { TRACKER_NAME_MAX_LENGTH, type DayState } from '../domain/tracker'

interface LedgerBasicsFieldsProps {
  name: string
  onNameChange: (value: string) => void
  nameError: string | null
  nameAutoFocus?: boolean
  defaultState: DayState | null
  onDefaultStateChange: (value: DayState) => void
  /** Rendered inside the name field, directly beneath the input/error -- e.g. Setup's suggestion disclosure. */
  afterName?: ReactNode
  /** Rendered immediately after the fieldset -- e.g. Setup's state-label flexibility hint. */
  afterFieldset?: ReactNode
}

/**
 * The name input and the default-day fieldset, shared between first-ledger
 * creation (Setup) and creating any later ledger (LedgerSwitcherSheet) --
 * the two forms otherwise duplicated this exactly. Anything specific to one
 * caller (Setup's suggestions, the switcher's color picker) stays with that
 * caller and slots in via afterName/afterFieldset rather than living here.
 */
export function LedgerBasicsFields({
  name,
  onNameChange,
  nameError,
  nameAutoFocus,
  defaultState,
  onDefaultStateChange,
  afterName,
  afterFieldset,
}: LedgerBasicsFieldsProps) {
  const nameId = useId()

  return (
    <>
      <div className="field">
        <label htmlFor={nameId}>What are you tracking?</label>
        <input
          id={nameId}
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          maxLength={TRACKER_NAME_MAX_LENGTH}
          autoComplete="off"
          autoFocus={nameAutoFocus}
        />
        {nameError && (
          <p role="alert" className="message">
            {nameError}
          </p>
        )}
        {afterName}
      </div>

      <fieldset>
        <legend>If I don't log anything, count the day as:</legend>
        <label>
          <input
            type="radio"
            name={`${nameId}-default-state`}
            checked={defaultState === 'did'}
            onChange={() => onDefaultStateChange('did')}
          />
          I did it
        </label>
        <label>
          <input
            type="radio"
            name={`${nameId}-default-state`}
            checked={defaultState === 'didnt'}
            onChange={() => onDefaultStateChange('didnt')}
          />
          I didn't do it
        </label>
      </fieldset>
      {afterFieldset}
    </>
  )
}
