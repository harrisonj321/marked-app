import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import {
  STATE_LABEL_MAX_LENGTH,
  otherDayState,
  validateStateLabel,
  type DayState,
  type StateLabels,
} from '../domain/tracker'
import { LEDGER_COLORS, LEDGER_COLOR_LABELS, type LedgerColor } from '../domain/ledger'
import { CloseIcon, SwapIcon } from './icons'

interface SettingsSheetProps {
  defaultState: DayState
  stateLabels: StateLabels
  color: LedgerColor | null
  onSaveDefaultState: (defaultState: DayState) => Promise<void>
  onSaveStateLabels: (stateLabels: StateLabels) => Promise<void>
  onSaveColor: (color: LedgerColor | null) => Promise<void>
  onTourNoted: () => void
  onDismiss: () => void
}

export function SettingsSheet({
  defaultState,
  stateLabels,
  color,
  onSaveDefaultState,
  onSaveStateLabels,
  onSaveColor,
  onTourNoted,
  onDismiss,
}: SettingsSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<DayState>(defaultState)
  const [labelDrafts, setLabelDrafts] = useState<StateLabels>(stateLabels)
  const [colorDraft, setColorDraft] = useState<LedgerColor | null>(color)
  const [defaultLabelError, setDefaultLabelError] = useState<string | null>(null)
  const [notedLabelError, setNotedLabelError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const titleId = useId()
  const defaultLabelId = useId()
  const notedLabelId = useId()

  // The ledger is live, so the stored default, labels, and color can
  // change under an open sheet (another device). Re-sync during render
  // rather than in an effect, so the form always shows what is actually
  // stored and an untouched field can never save a stale value back.
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
  // DayState is currently draft's default, and "Noted." always edits the
  // other -- so swapping just flips draft, and the two fields'  contents
  // trade places with it, keeping the role/position fixed.
  const notedState: DayState = otherDayState(draft)

  function handleSwap() {
    setDraft((current) => otherDayState(current))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const defaultValidation = validateStateLabel(labelDrafts[draft])
    const notedValidation = validateStateLabel(labelDrafts[notedState])

    setDefaultLabelError(defaultValidation.valid ? null : defaultValidation.error)
    setNotedLabelError(notedValidation.valid ? null : notedValidation.error)

    if (!defaultValidation.valid || !notedValidation.valid) {
      return
    }

    const nextLabels: StateLabels = {
      ...labelDrafts,
      [draft]: defaultValidation.label,
      [notedState]: notedValidation.label,
    }

    const defaultStateChanged = draft !== defaultState
    const labelsChanged =
      nextLabels.did !== syncedLabels.did || nextLabels.didnt !== syncedLabels.didnt
    const colorChanged = colorDraft !== syncedColor

    if (!defaultStateChanged && !labelsChanged && !colorChanged) {
      dialogRef.current?.close()
      return
    }

    setError(null)
    setSaving(true)
    try {
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

  return (
    <dialog
      ref={dialogRef}
      className="settings-sheet"
      aria-labelledby={titleId}
      onClose={onDismiss}
      onClick={handleBackdropClick}
    >
      <div className="settings-sheet-header">
        <h2 id={titleId}>Settings</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
        >
          <CloseIcon />
        </button>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
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

          <button
            type="button"
            className="icon-button state-role-swap"
            aria-label="Swap which state is default"
            onClick={handleSwap}
          >
            <SwapIcon />
          </button>

          <div className="state-role-row">
            <label htmlFor={notedLabelId}>Noted.</label>
            <input
              id={notedLabelId}
              type="text"
              value={labelDrafts[notedState]}
              onChange={(event) =>
                setLabelDrafts((current) => ({ ...current, [notedState]: event.target.value }))
              }
              maxLength={STATE_LABEL_MAX_LENGTH}
            />
          </div>
          {notedLabelError && (
            <p role="alert" className="message">
              {notedLabelError}
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
            <button
              type="button"
              className="ledger-color-chip ledger-color-chip-none"
              aria-pressed={colorDraft === null}
              aria-label="None"
              onClick={() => setColorDraft(null)}
            />
            {LEDGER_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className="ledger-color-chip"
                style={{ background: `var(--ledger-color-${swatch})` }}
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
          <button type="submit" disabled={saving}>
            Save
          </button>
        </div>
      </form>

      <div className="settings-secondary-actions">
        <button type="button" className="footer-link" onClick={onTourNoted}>
          Tour Noted.
        </button>
      </div>
    </dialog>
  )
}
