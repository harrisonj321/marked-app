import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { TRACKER_NAME_MAX_LENGTH, validateTrackerName, type DayState } from '../domain/tracker'
import {
  DEFAULT_LEDGER_COLOR,
  LEDGER_COLORS,
  LEDGER_COLOR_LABELS,
  type Ledger,
  type LedgerColor,
} from '../domain/ledger'
import { CloseIcon, EditIcon } from './icons'

export interface NewLedgerInput {
  name: string
  defaultState: DayState
  color: LedgerColor
}

interface LedgerSwitcherSheetProps {
  ledgers: Ledger[]
  activeLedgerId: string
  onSwitch: (ledgerId: string) => void
  onCreate: (input: NewLedgerInput) => Promise<void>
  onManage: (ledgerId: string) => void
  onDismiss: () => void
}

/**
 * Noted.'s one surface for picking a ledger: primarily a list to select
 * from, plus creating a new one. Renaming, recoloring, and deletion are not
 * handled here at all -- the manage affordance on each row hands off to the
 * single canonical Settings sheet (see SettingsSheet), targeted at that
 * row's ledger, so there is exactly one place that edits a ledger's
 * configuration regardless of which ledger or which entry point.
 */
export function LedgerSwitcherSheet({
  ledgers,
  activeLedgerId,
  onSwitch,
  onCreate,
  onManage,
  onDismiss,
}: LedgerSwitcherSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDefaultState, setNewDefaultState] = useState<DayState | null>(null)
  const [newColor, setNewColor] = useState<LedgerColor>(DEFAULT_LEDGER_COLOR)
  const [newNameError, setNewNameError] = useState<string | null>(null)
  const [newFormError, setNewFormError] = useState<string | null>(null)
  const [savingCreate, setSavingCreate] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close()
    }
  }

  function handleSelect(ledgerId: string) {
    if (ledgerId !== activeLedgerId) {
      onSwitch(ledgerId)
    }
    dialogRef.current?.close()
  }

  function handleManage(ledgerId: string) {
    onManage(ledgerId)
    dialogRef.current?.close()
  }

  function startCreating() {
    setNewName('')
    setNewDefaultState(null)
    setNewColor(DEFAULT_LEDGER_COLOR)
    setNewNameError(null)
    setNewFormError(null)
    setCreating(true)
  }

  async function handleCreateSubmit(event: FormEvent) {
    event.preventDefault()

    const validation = validateTrackerName(newName)
    if (!validation.valid) {
      setNewNameError(validation.error)
      return
    }

    if (!newDefaultState) {
      setNewNameError(null)
      setNewFormError('Choose what an untouched day means.')
      return
    }

    setNewNameError(null)
    setNewFormError(null)
    setSavingCreate(true)
    try {
      await onCreate({ name: validation.name, defaultState: newDefaultState, color: newColor })
      setCreating(false)
      dialogRef.current?.close()
    } catch {
      setNewFormError('Could not save. Try again.')
      setSavingCreate(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="ledger-sheet"
      aria-labelledby={titleId}
      onClose={onDismiss}
      onClick={handleBackdropClick}
    >
      <div className="settings-sheet-header">
        <h2 id={titleId}>Ledgers</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
        >
          <CloseIcon />
        </button>
      </div>

      <ul className="ledger-list">
        {ledgers.map((ledger) => (
          <li key={ledger.id} className="ledger-row">
            <button
              type="button"
              className="ledger-row-select"
              aria-current={ledger.id === activeLedgerId ? 'true' : undefined}
              onClick={() => handleSelect(ledger.id)}
            >
              {ledger.color && (
                <span
                  className="ledger-dot"
                  style={{ background: `var(--ledger-color-${ledger.color})` }}
                  aria-hidden="true"
                />
              )}
              <span className="ledger-row-name">{ledger.name}</span>
            </button>
            <button
              type="button"
              className="icon-button ledger-row-manage"
              aria-label={`Manage ${ledger.name}`}
              onClick={() => handleManage(ledger.id)}
            >
              <EditIcon />
            </button>
          </li>
        ))}
      </ul>

      {creating ? (
        <form onSubmit={(event) => void handleCreateSubmit(event)} noValidate className="ledger-new-form">
          <NewLedgerFields
            name={newName}
            onNameChange={setNewName}
            nameError={newNameError}
            defaultState={newDefaultState}
            onDefaultStateChange={setNewDefaultState}
            color={newColor}
            onColorChange={setNewColor}
          />

          {newFormError && (
            <p role="alert" className="message">
              {newFormError}
            </p>
          )}

          <div className="settings-actions">
            <button type="button" onClick={() => setCreating(false)} disabled={savingCreate}>
              Cancel
            </button>
            <button type="submit" disabled={savingCreate}>
              Save
            </button>
          </div>
        </form>
      ) : (
        <div className="settings-secondary-actions">
          <button type="button" className="footer-link" onClick={startCreating}>
            New ledger
          </button>
        </div>
      )}
    </dialog>
  )
}

interface NewLedgerFieldsProps {
  name: string
  onNameChange: (value: string) => void
  nameError: string | null
  defaultState: DayState | null
  onDefaultStateChange: (value: DayState) => void
  color: LedgerColor
  onColorChange: (value: LedgerColor) => void
}

function NewLedgerFields({
  name,
  onNameChange,
  nameError,
  defaultState,
  onDefaultStateChange,
  color,
  onColorChange,
}: NewLedgerFieldsProps) {
  const nameId = useId()
  const colorLabelId = useId()

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
          autoFocus
        />
        {nameError && (
          <p role="alert" className="message">
            {nameError}
          </p>
        )}
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

      <div className="field">
        <span id={colorLabelId}>Color</span>
        <div className="ledger-color-picker" role="group" aria-labelledby={colorLabelId}>
          {LEDGER_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className="ledger-color-chip"
              style={{ background: `var(--ledger-color-${swatch})` }}
              aria-pressed={color === swatch}
              aria-label={LEDGER_COLOR_LABELS[swatch]}
              onClick={() => onColorChange(swatch)}
            />
          ))}
        </div>
      </div>
    </>
  )
}
