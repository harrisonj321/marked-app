import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { TRACKER_NAME_MAX_LENGTH, validateTrackerName, type DayState } from '../domain/tracker'
import { LEDGER_COLORS, LEDGER_COLOR_LABELS, type Ledger, type LedgerColor } from '../domain/ledger'
import { CloseIcon, EditIcon } from './icons'

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
  onRename: (ledgerId: string, name: string) => Promise<void>
  onRecolor: (ledgerId: string, color: LedgerColor | null) => Promise<void>
  onDelete: (ledgerId: string) => Promise<void>
  onDismiss: () => void
}

/**
 * Noted.'s one surface for picking a ledger: primarily a list to select
 * from, with creation and per-ledger management folded quietly in rather
 * than laid out as a table. Renaming and recoloring happen in a small
 * edit state entered per row (see EditLedgerFields); Delete lives one level
 * further in, inside that edit state, rather than sitting beside every row
 * where a single destructive action would dominate the list.
 */
export function LedgerSwitcherSheet({
  ledgers,
  activeLedgerId,
  onSwitch,
  onCreate,
  onRename,
  onRecolor,
  onDelete,
  onDismiss,
}: LedgerSwitcherSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  const [managingId, setManagingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState<LedgerColor | null>(null)
  const [editNameError, setEditNameError] = useState<string | null>(null)
  const [editFormError, setEditFormError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

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

  function startManaging(ledger: Ledger) {
    setConfirmingDeleteId(null)
    setDeleteError(null)
    setEditName(ledger.name)
    setEditColor(ledger.color ?? null)
    setEditNameError(null)
    setEditFormError(null)
    setManagingId(ledger.id)
  }

  function cancelManaging() {
    setManagingId(null)
    setConfirmingDeleteId(null)
    setEditNameError(null)
    setEditFormError(null)
  }

  async function handleEditSubmit(event: FormEvent, ledger: Ledger) {
    event.preventDefault()

    const validation = validateTrackerName(editName)
    if (!validation.valid) {
      setEditNameError(validation.error)
      return
    }

    const nameChanged = validation.name !== ledger.name
    const colorChanged = editColor !== (ledger.color ?? null)

    if (!nameChanged && !colorChanged) {
      setManagingId(null)
      return
    }

    setEditNameError(null)
    setEditFormError(null)
    setEditSaving(true)
    try {
      if (nameChanged) {
        await onRename(ledger.id, validation.name)
      }
      if (colorChanged) {
        await onRecolor(ledger.id, editColor)
      }
      setManagingId(null)
    } catch {
      setEditFormError('Could not save. Try again.')
    } finally {
      setEditSaving(false)
    }
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
      setManagingId(null)
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
            ) : managingId === ledger.id ? (
              <EditLedgerFields
                name={editName}
                onNameChange={setEditName}
                nameError={editNameError}
                color={editColor}
                onColorChange={setEditColor}
                formError={editFormError}
                saving={editSaving}
                onSubmit={(event) => void handleEditSubmit(event, ledger)}
                onCancel={cancelManaging}
                onDeleteRequest={() => startConfirmingDelete(ledger.id)}
              />
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
                  className="icon-button ledger-row-manage"
                  aria-label={`Manage ${ledger.name}`}
                  onClick={() => startManaging(ledger)}
                >
                  <EditIcon />
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

interface ColorPickerProps {
  color: LedgerColor | null
  onColorChange: (value: LedgerColor | null) => void
  labelId: string
}

function ColorPicker({ color, onColorChange, labelId }: ColorPickerProps) {
  return (
    <div className="ledger-color-picker" role="group" aria-labelledby={labelId}>
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
        <ColorPicker color={color} onColorChange={onColorChange} labelId={colorLabelId} />
      </div>
    </>
  )
}

interface EditLedgerFieldsProps {
  name: string
  onNameChange: (value: string) => void
  nameError: string | null
  color: LedgerColor | null
  onColorChange: (value: LedgerColor | null) => void
  formError: string | null
  saving: boolean
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
  onDeleteRequest: () => void
}

/**
 * The tightly scoped manage view for one ledger row: rename and recolor
 * only (default state and word labels stay Settings' job for the active
 * ledger, unchanged). Delete lives here, quiet and last, rather than beside
 * every row in the list -- entering this view is itself the confirmation
 * that the user meant to manage this specific ledger, and the existing
 * confirm-before-delete step still guards the destructive step itself.
 */
function EditLedgerFields({
  name,
  onNameChange,
  nameError,
  color,
  onColorChange,
  formError,
  saving,
  onSubmit,
  onCancel,
  onDeleteRequest,
}: EditLedgerFieldsProps) {
  const nameId = useId()
  const colorLabelId = useId()

  return (
    <form onSubmit={onSubmit} noValidate className="ledger-edit-form">
      <div className="field">
        <label htmlFor={nameId} className="visually-hidden">
          Ledger name
        </label>
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

      <div className="field">
        <span id={colorLabelId} className="visually-hidden">
          Color
        </span>
        <ColorPicker color={color} onColorChange={onColorChange} labelId={colorLabelId} />
      </div>

      {formError && (
        <p role="alert" className="message">
          {formError}
        </p>
      )}

      <div className="settings-actions">
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" disabled={saving}>
          Save
        </button>
      </div>

      <div className="settings-secondary-actions">
        <button type="button" className="footer-link ledger-row-delete" onClick={onDeleteRequest}>
          Delete
        </button>
      </div>
    </form>
  )
}
