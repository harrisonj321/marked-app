import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent } from 'react'
import { IconButton } from '@maker428/ui'
import {
  STATE_LABEL_MAX_LENGTH,
  TRACKER_NAME_MAX_LENGTH,
  otherDayState,
  validateStateLabel,
  validateTrackerName,
  type DayState,
  type StateLabels,
} from '../domain/tracker'
import { LEDGER_COLORS, LEDGER_COLOR_LABELS, type LedgerColor } from '../domain/ledger'
import { describeAuthError } from '../lib/authErrors'
import { CloseIcon, SwapIcon } from './icons'

interface SettingsSheetProps {
  name: string
  defaultState: DayState
  stateLabels: StateLabels
  /** Always the already-resolved color (see domain/ledger.ts's resolveLedgerColor) -- never "no color", so the picker always has exactly one correct swatch to show as selected. */
  color: LedgerColor
  onSaveName: (name: string) => Promise<void>
  onSaveDefaultState: (defaultState: DayState) => Promise<void>
  onSaveStateLabels: (stateLabels: StateLabels) => Promise<void>
  onSaveColor: (color: LedgerColor) => Promise<void>
  onDelete: () => Promise<void>
  onTourMarked: () => void
  onDismiss: () => void
  /** The signed-in account's auth provider -- 'password' or 'google.com' -- decides which reauthentication step account deletion asks for. */
  authProviderId: string
  /** Reauthenticates, deletes every piece of this account's data, then deletes the Auth identity itself -- see Home's handleDeleteAccount. `password` is required and used only for a 'password'-provider account. */
  onDeleteAccount: (password?: string) => Promise<void>
}

/**
 * The one canonical settings surface for a ledger -- reached either from
 * the home screen's own footer link (targeting the active ledger) or from
 * the ledger catalog's manage affordance (targeting whichever ledger was
 * selected there, active or not). Both entry points render this exact same
 * component; there is no second inline editor. The legacy migrated ledger
 * is just another ledger here -- nothing in this component branches on
 * which one it is.
 */
export function SettingsSheet({
  name,
  defaultState,
  stateLabels,
  color,
  onSaveName,
  onSaveDefaultState,
  onSaveStateLabels,
  onSaveColor,
  onDelete,
  onTourMarked,
  onDismiss,
  authProviderId,
  onDeleteAccount,
}: SettingsSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [nameDraft, setNameDraft] = useState(name)
  const [draft, setDraft] = useState<DayState>(defaultState)
  const [labelDrafts, setLabelDrafts] = useState<StateLabels>(stateLabels)
  const [colorDraft, setColorDraft] = useState<LedgerColor>(color)
  const [nameError, setNameError] = useState<string | null>(null)
  const [defaultLabelError, setDefaultLabelError] = useState<string | null>(null)
  const [markedLabelError, setMarkedLabelError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [confirmingDeleteAccount, setConfirmingDeleteAccount] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null)
  const [accountPassword, setAccountPassword] = useState('')

  const titleId = useId()
  const accountPasswordId = useId()
  const nameId = useId()
  const defaultLabelId = useId()
  const markedLabelId = useId()

  // The ledger is live, so the stored name, default, labels, and color can
  // change under an open sheet (another device). Re-sync during render
  // rather than in an effect, so the form always shows what is actually
  // stored and an untouched field can never save a stale value back.
  const [syncedName, setSyncedName] = useState(name)
  if (name !== syncedName) {
    setSyncedName(name)
    setNameDraft(name)
  }

  const [syncedDefault, setSyncedDefault] = useState(defaultState)
  if (defaultState !== syncedDefault) {
    setSyncedDefault(defaultState)
    setDraft(defaultState)
  }

  const [syncedLabels, setSyncedLabels] = useState(stateLabels)
  if (stateLabels.did !== syncedLabels.did || stateLabels.didnt !== syncedLabels.didnt) {
    setSyncedLabels(stateLabels)
    setLabelDrafts(stateLabels)
  }

  const [syncedColor, setSyncedColor] = useState(color)
  if (color !== syncedColor) {
    setSyncedColor(color)
    setColorDraft(color)
  }

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close()
    }
  }

  // The "Default" field always edits the label of whichever underlying
  // DayState is currently draft's default, and "Marked." always edits the
  // other -- so swapping just flips draft, and the two fields'  contents
  // trade places with it, keeping the role/position fixed.
  const markedState: DayState = otherDayState(draft)

  function handleSwap() {
    setDraft((current) => otherDayState(current))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const nameValidation = validateTrackerName(nameDraft)
    const defaultValidation = validateStateLabel(labelDrafts[draft])
    const markedValidation = validateStateLabel(labelDrafts[markedState])

    setNameError(nameValidation.valid ? null : nameValidation.error)
    setDefaultLabelError(defaultValidation.valid ? null : defaultValidation.error)
    setMarkedLabelError(markedValidation.valid ? null : markedValidation.error)

    if (!nameValidation.valid || !defaultValidation.valid || !markedValidation.valid) {
      return
    }

    const nextLabels: StateLabels = {
      ...labelDrafts,
      [draft]: defaultValidation.label,
      [markedState]: markedValidation.label,
    }

    const nameChanged = nameValidation.name !== syncedName
    const defaultStateChanged = draft !== defaultState
    const labelsChanged =
      nextLabels.did !== syncedLabels.did || nextLabels.didnt !== syncedLabels.didnt
    const colorChanged = colorDraft !== syncedColor

    if (!nameChanged && !defaultStateChanged && !labelsChanged && !colorChanged) {
      dialogRef.current?.close()
      return
    }

    setError(null)
    setSaving(true)
    try {
      if (nameChanged) {
        await onSaveName(nameValidation.name)
      }
      if (defaultStateChanged) {
        await onSaveDefaultState(draft)
      }
      if (labelsChanged) {
        await onSaveStateLabels(nextLabels)
      }
      if (colorChanged) {
        await onSaveColor(colorDraft)
      }
      dialogRef.current?.close()
    } catch {
      setError('Could not save. Try again.')
      setSaving(false)
    }
  }

  function startConfirmingDelete() {
    setDeleteError(null)
    setConfirmingDelete(true)
  }

  function cancelConfirmingDelete() {
    setConfirmingDelete(false)
    setDeleteError(null)
  }

  async function handleConfirmDelete() {
    setDeleteError(null)
    setDeleting(true)
    try {
      await onDelete()
      dialogRef.current?.close()
    } catch {
      setDeleteError('Could not delete. Try again.')
      setDeleting(false)
    }
  }

  function startConfirmingDeleteAccount() {
    setDeleteAccountError(null)
    setAccountPassword('')
    setConfirmingDeleteAccount(true)
  }

  function cancelConfirmingDeleteAccount() {
    setConfirmingDeleteAccount(false)
    setDeleteAccountError(null)
    setAccountPassword('')
  }

  async function handleConfirmDeleteAccount() {
    if (authProviderId === 'password' && !accountPassword) {
      setDeleteAccountError('Enter your password to confirm.')
      return
    }

    setDeleteAccountError(null)
    setDeletingAccount(true)
    try {
      await onDeleteAccount(authProviderId === 'password' ? accountPassword : undefined)
      // On success the account is fully deleted and signed out; App reacts
      // to the auth state change and unmounts this whole tree, so there is
      // nothing further to close/reset here.
    } catch (err) {
      setDeleteAccountError(describeAuthError(err))
      setDeletingAccount(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="settings-sheet"
      aria-labelledby={titleId}
      onClose={onDismiss}
      onClick={handleBackdropClick}
      // Everything on this sheet is operating on one ledger, so the
      // ledger's own color -- not the app's shared ink -- is the accent
      // here, and Save carries it. Driven by the live draft rather than
      // the stored color, so picking a swatch shows what that choice
      // actually looks like as this ledger's action color before it is
      // saved. Only .button-primary and .count-chip-active read this; the
      // deletion confirmations below stay deliberately neutral.
      style={{ '--ledger-accent': `var(--ledger-color-${colorDraft})` } as CSSProperties}
    >
      <div className="settings-sheet-header">
        <h2 id={titleId}>Settings</h2>
        <IconButton label="Close" onClick={() => dialogRef.current?.close()}>
          <CloseIcon />
        </IconButton>
      </div>

      {confirmingDelete ? (
        <div className="delete-confirm">
          <p>{`Delete "${name}" and its history?`}</p>
          {deleteError && (
            <p role="alert" className="message">
              {deleteError}
            </p>
          )}
          <div className="delete-confirm-actions">
            <button
              type="button"
              aria-label={`Delete ${name} forever`}
              onClick={() => void handleConfirmDelete()}
              disabled={deleting}
            >
              Delete
            </button>
            <button type="button" onClick={cancelConfirmingDelete} disabled={deleting}>
              Cancel
            </button>
          </div>
        </div>
      ) : confirmingDeleteAccount ? (
        <div className="delete-confirm">
          <p>Permanently delete your account, every ledger, and all of their history? This cannot be undone.</p>
          {authProviderId === 'password' ? (
            <div className="field">
              <label htmlFor={accountPasswordId}>Password</label>
              <input
                id={accountPasswordId}
                type="password"
                autoComplete="current-password"
                value={accountPassword}
                onChange={(event) => setAccountPassword(event.target.value)}
              />
            </div>
          ) : (
            <p className="field-hint">You'll be asked to confirm with Google.</p>
          )}
          {deleteAccountError && (
            <p role="alert" className="message">
              {deleteAccountError}
            </p>
          )}
          <div className="delete-confirm-actions">
            <button
              type="button"
              aria-label="Delete account forever"
              onClick={() => void handleConfirmDeleteAccount()}
              disabled={deletingAccount}
            >
              Delete account
            </button>
            <button type="button" onClick={cancelConfirmingDeleteAccount} disabled={deletingAccount}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={(event) => void handleSubmit(event)} noValidate>
            <div className="field">
              <label htmlFor={nameId}>Name</label>
              <input
                id={nameId}
                type="text"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                maxLength={TRACKER_NAME_MAX_LENGTH}
                autoComplete="off"
              />
              {nameError && (
                <p role="alert" className="message">
                  {nameError}
                </p>
              )}
            </div>

            <div className="state-roles">
              <div className="state-role-row">
                <label htmlFor={defaultLabelId}>Default</label>
                <input
                  id={defaultLabelId}
                  type="text"
                  value={labelDrafts[draft]}
                  onChange={(event) =>
                    setLabelDrafts((current) => ({ ...current, [draft]: event.target.value }))
                  }
                  maxLength={STATE_LABEL_MAX_LENGTH}
                />
              </div>
              {defaultLabelError && (
                <p role="alert" className="message">
                  {defaultLabelError}
                </p>
              )}

              <IconButton className="state-role-swap" label="Swap which state is default" onClick={handleSwap}>
                <SwapIcon />
              </IconButton>

              <div className="state-role-row">
                <label htmlFor={markedLabelId}>Marked.</label>
                <input
                  id={markedLabelId}
                  type="text"
                  value={labelDrafts[markedState]}
                  onChange={(event) =>
                    setLabelDrafts((current) => ({ ...current, [markedState]: event.target.value }))
                  }
                  maxLength={STATE_LABEL_MAX_LENGTH}
                />
              </div>
              {markedLabelError && (
                <p role="alert" className="message">
                  {markedLabelError}
                </p>
              )}
            </div>

            <div className="field">
              <span id={`${titleId}-color-label`}>Color</span>
              <div
                className="ledger-color-picker"
                role="group"
                aria-labelledby={`${titleId}-color-label`}
              >
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
                    aria-pressed={colorDraft === swatch}
                    aria-label={LEDGER_COLOR_LABELS[swatch]}
                    onClick={() => setColorDraft(swatch)}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p role="alert" className="message">
                {error}
              </p>
            )}

            <div className="settings-actions">
              <button type="submit" className="button-primary" disabled={saving}>
                Save
              </button>
            </div>
          </form>

          <div className="settings-secondary-actions">
            <button type="button" className="footer-link" onClick={onTourMarked}>
              Tour Marked.
            </button>
          </div>

          <div className="settings-danger">
            <button type="button" className="footer-link" onClick={startConfirmingDelete}>
              Delete ledger
            </button>
          </div>

          <div className="settings-danger">
            <button type="button" className="footer-link" onClick={startConfirmingDeleteAccount}>
              Delete account
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}
