import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { LEDGER_NAME_SUGGESTIONS } from '../domain/ledgerSuggestions'
import {
  STATE_LABEL_MAX_LENGTH,
  TRACKER_NAME_MAX_LENGTH,
  validateStateLabel,
  validateTrackerName,
  type DayState,
  type StateLabels,
} from '../domain/tracker'
import {
  DEFAULT_LEDGER_COLOR,
  LEDGER_COLORS,
  LEDGER_COLOR_LABELS,
  resolveLedgerColor,
  type Ledger,
  type LedgerColor,
} from '../domain/ledger'
import { CloseIcon, EditIcon } from './icons'

export interface NewLedgerInput {
  name: string
  defaultState: DayState
  stateLabels: StateLabels
  color: LedgerColor
}

interface LedgerSwitcherSheetProps {
  ledgers: Ledger[]
  activeLedgerId: string | null
  onSwitch: (ledgerId: string) => void
  onCreate: (input: NewLedgerInput) => Promise<void>
  onManage: (ledgerId: string) => void
  onDismiss: () => void
}

/** The creation form's own starting point -- edited before saving, never silently kept. */
const STARTING_STATE_LABELS: StateLabels = { did: 'Yes', didnt: 'No' }

/**
 * Noted.'s one surface for picking a ledger: primarily a list to select
 * from, plus creating a new one -- this is also the exact surface a
 * brand-new account's first ledger is created through (see Home, which
 * auto-opens this straight into the creation form when the account has no
 * ledgers yet), so there is exactly one ledger-creation experience, not a
 * lookalike copy for onboarding. Renaming, recoloring, and deletion are not
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
  const nameId = useId()
  const didLabelId = useId()
  const didntLabelId = useId()
  const colorLabelId = useId()

  // A brand-new account has no ledgers at all, so Home renders this sheet
  // already pointed straight at the creation form (see startCreating's
  // initializer below) with its own example-suggestions helper -- neither
  // applies once there's at least one real ledger to browse.
  const isFirstLedger = ledgers.length === 0

  const [creating, setCreating] = useState(isFirstLedger)
  const [newName, setNewName] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [newStateLabels, setNewStateLabels] = useState<StateLabels>(STARTING_STATE_LABELS)
  const [newDefaultState, setNewDefaultState] = useState<DayState | null>(null)
  const [newColor, setNewColor] = useState<LedgerColor>(DEFAULT_LEDGER_COLOR)
  const [newNameError, setNewNameError] = useState<string | null>(null)
  const [didLabelError, setDidLabelError] = useState<string | null>(null)
  const [didntLabelError, setDidntLabelError] = useState<string | null>(null)
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
    setSuggestionsOpen(false)
    setNewStateLabels(STARTING_STATE_LABELS)
    setNewDefaultState(null)
    setNewColor(DEFAULT_LEDGER_COLOR)
    setNewNameError(null)
    setDidLabelError(null)
    setDidntLabelError(null)
    setNewFormError(null)
    setCreating(true)
  }

  function selectSuggestion(suggestion: string) {
    setNewName(suggestion)
    setNewNameError(null)
    setSuggestionsOpen(false)
  }

  async function handleCreateSubmit(event: FormEvent) {
    event.preventDefault()

    const nameValidation = validateTrackerName(newName)
    const didValidation = validateStateLabel(newStateLabels.did)
    const didntValidation = validateStateLabel(newStateLabels.didnt)

    setNewNameError(nameValidation.valid ? null : nameValidation.error)
    setDidLabelError(didValidation.valid ? null : didValidation.error)
    setDidntLabelError(didntValidation.valid ? null : didntValidation.error)

    if (!nameValidation.valid || !didValidation.valid || !didntValidation.valid) {
      return
    }

    if (!newDefaultState) {
      setNewFormError('Choose what an untouched day means.')
      return
    }

    setNewFormError(null)
    setSavingCreate(true)
    try {
      await onCreate({
        name: nameValidation.name,
        defaultState: newDefaultState,
        stateLabels: { did: didValidation.label, didnt: didntValidation.label },
        color: newColor,
      })
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
              <span
                className="ledger-dot"
                style={{ background: `var(--ledger-color-${resolveLedgerColor(ledger.color)})` }}
                aria-hidden="true"
              />
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
          <div className="field">
            <label htmlFor={nameId}>What are you tracking?</label>
            <input
              id={nameId}
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={TRACKER_NAME_MAX_LENGTH}
              autoComplete="off"
              autoFocus
            />
            {newNameError && (
              <p role="alert" className="message">
                {newNameError}
              </p>
            )}
            {isFirstLedger && (
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
            )}
          </div>

          <div className="field">
            <label htmlFor={didLabelId}>First state</label>
            <input
              id={didLabelId}
              type="text"
              value={newStateLabels.did}
              onChange={(event) =>
                setNewStateLabels((current) => ({ ...current, did: event.target.value }))
              }
              maxLength={STATE_LABEL_MAX_LENGTH}
            />
            {didLabelError && (
              <p role="alert" className="message">
                {didLabelError}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor={didntLabelId}>Second state</label>
            <input
              id={didntLabelId}
              type="text"
              value={newStateLabels.didnt}
              onChange={(event) =>
                setNewStateLabels((current) => ({ ...current, didnt: event.target.value }))
              }
              maxLength={STATE_LABEL_MAX_LENGTH}
            />
            {didntLabelError && (
              <p role="alert" className="message">
                {didntLabelError}
              </p>
            )}
          </div>

          <fieldset>
            <legend>If I don't log anything, count the day as:</legend>
            <label>
              <input
                type="radio"
                name={`${nameId}-default-state`}
                checked={newDefaultState === 'did'}
                onChange={() => setNewDefaultState('did')}
              />
              {newStateLabels.did || 'First state'}
            </label>
            <label>
              <input
                type="radio"
                name={`${nameId}-default-state`}
                checked={newDefaultState === 'didnt'}
                onChange={() => setNewDefaultState('didnt')}
              />
              {newStateLabels.didnt || 'Second state'}
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
                  aria-pressed={newColor === swatch}
                  aria-label={LEDGER_COLOR_LABELS[swatch]}
                  onClick={() => setNewColor(swatch)}
                />
              ))}
            </div>
          </div>

          {newFormError && (
            <p role="alert" className="message">
              {newFormError}
            </p>
          )}

          <div className="settings-actions">
            {!isFirstLedger && (
              <button type="button" onClick={() => setCreating(false)} disabled={savingCreate}>
                Cancel
              </button>
            )}
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
