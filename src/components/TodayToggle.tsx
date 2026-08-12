import { useId } from 'react'
import { DEFAULT_STATE_LABELS, type DayState, type StateLabels } from '../domain/tracker'

const POSITIONS = ['did', 'didnt'] as const

interface TodayToggleProps {
  state: DayState
  onSelect: (state: DayState) => void
  labels?: StateLabels
}

/**
 * The primary daily control: a two-position slide switch. Both state words
 * are printed on the track and an ink card covers today's state; tapping
 * the other word moves the ink there. Selecting the already-current side
 * is a no-op, so an accidental flip is undone by tapping back, never by
 * re-tapping the same spot.
 */
export function TodayToggle({ state, onSelect, labels = DEFAULT_STATE_LABELS }: TodayToggleProps) {
  const groupName = useId()

  return (
    <div className="today-toggle" data-state={state} role="radiogroup" aria-label="Today">
      {POSITIONS.map((position) => (
        <label key={position} className="today-toggle-option">
          <input
            type="radio"
            className="visually-hidden"
            name={groupName}
            value={position}
            checked={state === position}
            onChange={() => onSelect(position)}
          />
          <span className="today-toggle-word">{labels[position]}</span>
        </label>
      ))}
      <div className="today-toggle-ink-shadow" aria-hidden="true">
        <div className="today-toggle-ink">
          <span>{labels.did}</span>
          <span>{labels.didnt}</span>
        </div>
      </div>
    </div>
  )
}
