import { COUNT_MAX, COUNT_OTHER_MIN, type CountMode } from '../domain/day'

const CHIP_LABEL: Record<Exclude<CountMode, 'none'>, string> = {
  two: '2×',
  three: '3×',
  other: 'Other',
}

const CHIPS = ['two', 'three', 'other'] as const

interface CountSelectorProps {
  mode: CountMode
  otherDraft: string
  otherError?: string | null
  onSelect: (mode: CountMode) => void
  onOtherDraftChange: (value: string) => void
  otherInputId: string
}

export function CountSelector({
  mode,
  otherDraft,
  otherError,
  onSelect,
  onOtherDraftChange,
  otherInputId,
}: CountSelectorProps) {
  function handleChipClick(chip: Exclude<CountMode, 'none'>) {
    onSelect(mode === chip ? 'none' : chip)
  }

  return (
    <div className="count-selector">
      <div className="count-chips" role="group" aria-label="Count">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            className={`count-chip ${mode === chip ? 'count-chip-active' : ''}`}
            aria-pressed={mode === chip}
            onClick={() => handleChipClick(chip)}
          >
            {CHIP_LABEL[chip]}
          </button>
        ))}
      </div>

      {mode === 'other' && (
        <div className="field">
          <label htmlFor={otherInputId} className="visually-hidden">
            Custom count
          </label>
          <input
            id={otherInputId}
            type="number"
            inputMode="numeric"
            min={COUNT_OTHER_MIN}
            max={COUNT_MAX}
            placeholder={`${COUNT_OTHER_MIN} or more`}
            value={otherDraft}
            onChange={(event) => onOtherDraftChange(event.target.value)}
            autoFocus
          />
          {otherError && (
            <p role="alert" className="message">
              {otherError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
