import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { TRACKER_NAME_MAX_LENGTH, validateTrackerName, type DayState } from '../domain/tracker'
import { LEDGER_COLORS, LEDGER_COLOR_LABELS, type Ledger, type LedgerColor } from '../domain/ledger'
import { CloseIcon } from './icons'

export interface NewLedgerInput {
  name: string
  defaultState: DayState
  color: LedgerColor | null
}

interface LedgerSwitcherSheetProps {
  ledgers: Ledger[]
  activeLedgerId: string
  onSwitch: (ledgerId: string) => void
  onCreate: (input: NewLedgerInput) => Promise<void>
  onDelete: (ledgerId: string) => Promise<void>
  onDismiss: () => void
}

/**
 * The one compact surface for switching, creating, and removing ledgers.
 * Renaming a ledger and changing its color happen through the existing
 * Home/Settings flows instead, once it is the active one -- keeping this
 * sheet itself small: select, add, remove, nothing else.
 */
export function LedgerSwitcherSheet({
  ledgers,
  activeLedgerId,
  onSwitch,
  onCreate,
  onDelete,
  onDismiss,
}: LedgerSwitcherSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDefaultState, setNewDefaultState] = useState<DayState | null>(null)
  const [newColor, setNewColor] = useState<LedgerColor | null>(null)
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

  function startConfirmingDelete(ledgerId: string) {
    setDeleteError(null)
    setConfirmingDeleteId(ledgerId)
  }

  function cancelConfirmingDelete() {
    setConfirmingDeleteId(null)
    setDeleteError(null)
  }

  async function handleConfirmDelete(ledgerId: string) {
    setDeleteError(null)
    setDeleting(true)
    try {
      await onDelete(ledgerId)
      setConfirmingDeleteId(null)
    } catch {
      setDeleteError('Could not delete. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  function startCreating() {
    setNewName('')
    setNewDefaultState(null)
    setNewColor(null)
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
            {confirmingDeleteId === ledger.id ? (
              <div className="ledger-row-confirm">
                <p>{`Delete "${ledger.name}" and its history?`}</p>
                {deleteError && (
                  <p role="alert" className="message">
                    {deleteError}
                  </p>
                )}
                <div className="ledger-row-confirm-actions">
                  <button
                    type="button"
                    aria-label={`Delete ${ledger.name} forever`}
                    onClick={() => void handleConfirmDelete(ledger.id)}
                    disabled={deleting}
                  >
                    Delete
                  </button>
                  <button type="button" onClick={cancelConfirmingDelete} disabled={deleting}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                  className="footer-link ledger-row-delete"
                  aria-label={`Delete ${ledger.name}`}
                  onClick={() => startConfirmingDelete(ledger.id)}
                >
                  Delete
                </button>
              </>
            )}
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
  color: LedgerColor | null
  onColorChange: (value: LedgerColor | null) => void
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
          <button
            type="button"
            className="ledger-color-chip ledger-color-chip-none"
            aria-pressed={color === null}
            aria-label="None"
            onClick={() => onColorChange(null)}
          />
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
