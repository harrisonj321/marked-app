import { useId } from 'react'
import type { DayState } from '../domain/tracker'

const STATE_LABEL = { did: 'Did', didnt: "Didn't" } as const
const POSITIONS = ['did', 'didnt'] as const

interface TodayToggleProps {
  state: DayState
  onSelect: (state: DayState) => void
}

/**
 * The primary daily control: a two-position slide switch. Both state words
 * are printed on the track and an ink card covers today's state; tapping
 * the other word moves the ink there. Selecting the already-current side
 * is a no-op, so an accidental flip is undone by tapping back, never by
 * re-tapping the same spot.
 */
export function TodayToggle({ state, onSelect }: TodayToggleProps) {
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
          <span className="today-toggle-word">{STATE_LABEL[position]}</span>
        </label>
      ))}
      <div className="today-toggle-ink" aria-hidden="true">
        <span>{STATE_LABEL.did}</span>
        <span>{STATE_LABEL.didnt}</span>
      </div>
    </div>
  )
}
