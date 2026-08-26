import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type SyntheticEvent,
} from 'react'
import { LEDGER_NAME_SUGGESTIONS } from '../domain/ledgerSuggestions'
import {
  TRACKER_NAME_MAX_LENGTH,
  validateStateLabel,
  validateTrackerName,
  type DayState,
  type StateLabels,
} from '../domain/tracker'
import { StateLabelFields } from './StateLabelFields'
import {
  DEFAULT_LEDGER_COLOR,
  LEDGER_COLORS,
  LEDGER_COLOR_LABELS,
  resolveLedgerColor,
  type Ledger,
  type LedgerColor,
} from '../domain/ledger'
import { CloseIcon, EditIcon, PlusIcon } from './icons'

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

/**
 * Marked.'s one surface for picking a ledger: primarily a list to select
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
  const defaultLabelId = useId()
  const markedLabelId = useId()
  const colorLabelId = useId()

  // A brand-new account has no ledgers at all, so Home renders this sheet
  // already pointed straight at the creation form (see startCreating's
  // initializer below) with its own example-suggestions helper -- neither
  // applies once there's at least one real ledger to browse.
  const isFirstLedger = ledgers.length === 0

  const [creating, setCreating] = useState(isFirstLedger)
  const [newName, setNewName] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [newDefaultLabel, setNewDefaultLabel] = useState('')
  const [newMarkedLabel, setNewMarkedLabel] = useState('')
  const [newColor, setNewColor] = useState<LedgerColor>(DEFAULT_LEDGER_COLOR)
  const [newNameError, setNewNameError] = useState<string | null>(null)
  const [defaultLabelError, setDefaultLabelError] = useState<string | null>(null)
  const [markedLabelError, setMarkedLabelError] = useState<string | null>(null)
  const [newFormError, setNewFormError] = useState<string | null>(null)
  const [savingCreate, setSavingCreate] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // A brand-new account has nothing to fall back to if this sheet closes
  // without creating a ledger -- see Home's own defensive empty-state
  // fallback for the case where it somehow does anyway. So for the first
  // ledger, every normal dismiss path (X, backdrop click, Escape) is
  // disabled; only actually creating a ledger closes it. Once there is at
  // least one real ledger, every one of these behaves exactly as before.
  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (isFirstLedger) return
    if (event.target === dialogRef.current) {
      dialogRef.current?.close()
    }
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    if (isFirstLedger) {
      event.preventDefault()
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
    setNewDefaultLabel('')
    setNewMarkedLabel('')
    setNewColor(DEFAULT_LEDGER_COLOR)
    setNewNameError(null)
    setDefaultLabelError(null)
    setMarkedLabelError(null)
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
    const defaultValidation = validateStateLabel(newDefaultLabel)
    const markedValidation = validateStateLabel(newMarkedLabel)

    setNewNameError(nameValidation.valid ? null : nameValidation.error)
    setDefaultLabelError(defaultValidation.valid ? null : defaultValidation.error)
    setMarkedLabelError(markedValidation.valid ? null : markedValidation.error)

    if (!nameValidation.valid || !defaultValidation.valid || !markedValidation.valid) {
      return
    }

    setNewFormError(null)
    setSavingCreate(true)
    try {
      await onCreate({
        name: nameValidation.name,
        // The "Default state" field is always what an untouched day
        // resolves to -- there is no separate radio choosing it, so the
        // underlying DayState key it's stored under is fixed here.
        defaultState: 'didnt',
        stateLabels: { didnt: defaultValidation.label, did: markedValidation.label },
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
      onCancel={handleCancel}
    >
      <div className="settings-sheet-header">
        <h2 id={titleId}>Ledgers</h2>
        {!isFirstLedger && (
          <button
            type="button"
            className="icon-button"
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
          >
            <CloseIcon />
          </button>
        )}
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
                // A row shows its OWN ledger's color, so its fill and its
                // halo both come from this one value rather than from any
                // surrounding accent -- see .ledger-dot.
                style={
                  {
                    background: `var(--ledger-color-${resolveLedgerColor(ledger.color)})`,
                    '--glow-color': `var(--ledger-color-${resolveLedgerColor(ledger.color)})`,
                  } as CSSProperties
                }
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
              <EditIcon size={16} />
            </button>
          </li>
        ))}
      </ul>

      {creating ? (
        <form
          onSubmit={(event) => void handleCreateSubmit(event)}
          noValidate
          className="ledger-new-form"
          // The ledger being created owns this form's primary action: Save
          // carries the color currently picked for it (and updates live as
          // the picker changes), rather than the app's generic ink. Scoped
          // to the form, not the sheet, so the catalog rows above -- which
          // list other ledgers -- stay neutral.
          style={{ '--ledger-accent': `var(--ledger-color-${newColor})` } as CSSProperties}
        >
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
              <div className="ledger-disclosure">
                <button
                  type="button"
                  className="footer-link disclosure-toggle"
                  aria-expanded={suggestionsOpen}
                  onClick={() => setSuggestionsOpen((open) => !open)}
                >
                  Not sure what to mark? Try one of these.
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

          <StateLabelFields
            defaultLabelId={defaultLabelId}
            markedLabelId={markedLabelId}
            defaultValue={newDefaultLabel}
            markedValue={newMarkedLabel}
            onDefaultChange={setNewDefaultLabel}
            onMarkedChange={setNewMarkedLabel}
            defaultError={defaultLabelError}
            markedError={markedLabelError}
          />

          <div className="field">
            <span id={colorLabelId}>Color</span>
            <div className="ledger-color-picker" role="group" aria-labelledby={colorLabelId}>
              {LEDGER_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className="ledger-color-chip"
                  style={
                    {
                      background: `var(--ledger-color-${swatch})`,
                      '--glow-color': `var(--ledger-color-${swatch})`,
                    } as CSSProperties
                  }
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
              <button
                type="button"
                className="button-quiet"
                onClick={() => setCreating(false)}
                disabled={savingCreate}
              >
                Cancel
              </button>
            )}
            <button type="submit" className="button-primary" disabled={savingCreate}>
              Save
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="ledger-add" onClick={startCreating}>
          <span className="ledger-add-glyph" aria-hidden="true">
            <PlusIcon />
          </span>
          New ledger
        </button>
      )}
    </dialog>
  )
}
