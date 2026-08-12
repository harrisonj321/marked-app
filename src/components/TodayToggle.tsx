import {
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { DEFAULT_STATE_LABELS, otherDayState, type DayState, type StateLabels } from '../domain/tracker'

interface TodayToggleProps {
  state: DayState
  defaultState: DayState
  onSelect: (state: DayState) => void
  labels?: StateLabels
}

const DRAG_THRESHOLD_PX = 6

interface DragTracking {
  pointerId: number
  startX: number
  dragging: boolean
}

/**
 * The primary daily control: a two-position slide switch. The untouched-day
 * default always sits on the left and the actively-Noted state on the
 * right, regardless of which underlying DayState each currently is -- so
 * changing the tracker's default in Settings reorders which word appears
 * where without touching what's stored.
 *
 * Both state words are printed on the track and an ink card covers today's
 * state; tapping the other word -- or dragging the ink there and releasing
 * -- moves it. Position is driven by the --x custom property (0 = left,
 * 1 = right) so a live drag and a settled tap/release share one clip-path
 * formula; a bouncy transition timing function on that shared property is
 * what gives every settle, tap or drag-release alike, its spring for free.
 */
export function TodayToggle({
  state,
  defaultState,
  onSelect,
  labels = DEFAULT_STATE_LABELS,
}: TodayToggleProps) {
  const groupName = useId()
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragTracking | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const otherState: DayState = otherDayState(defaultState)
  const positions: readonly DayState[] = [defaultState, otherState]
  const activeSide = state === defaultState ? 'left' : 'right'

  function resolveFraction(clientX: number): number | null {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return null
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // Always start fresh tracking rather than ignoring this pointerdown when
    // one is already recorded: if a prior gesture's pointerup/pointercancel
    // was ever lost (capture stolen, browser/OS interruption), refusing new
    // pointerdowns here would permanently lock the control. A stray second
    // simultaneous finger overriding the first is a far smaller cost than
    // that.
    drag.current = { pointerId: event.pointerId, startX: event.clientX, dragging: false }
  }

  // setPointerCapture/releasePointerCapture are spec'd to be able to throw
  // NotFoundError (e.g. a pointer the browser no longer considers active) --
  // an uncaught throw here would abort the rest of the handler mid-update,
  // so capture is best-effort and never allowed to break the drag itself.
  function tryCapture(target: HTMLDivElement, pointerId: number) {
    try {
      target.setPointerCapture(pointerId)
    } catch {
      // Best-effort: dragging still works via move/up on this element as
      // long as the pointer stays within its bounds.
    }
  }

  function tryReleaseCapture(target: HTMLDivElement, pointerId: number) {
    try {
      target.releasePointerCapture(pointerId)
    } catch {
      // Already released or never captured -- nothing to do.
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const tracking = drag.current
    if (!tracking || tracking.pointerId !== event.pointerId) return

    if (!tracking.dragging) {
      // Below the threshold this is still a plain tap-in-progress; leave it
      // to the label's native click so simple taps are completely
      // untouched by drag logic.
      if (Math.abs(event.clientX - tracking.startX) < DRAG_THRESHOLD_PX) return
      const fraction = resolveFraction(event.clientX)
      if (fraction === null) return
      tracking.dragging = true
      tryCapture(event.currentTarget, event.pointerId)
      setIsDragging(true)
    }

    const fraction = resolveFraction(event.clientX)
    if (fraction === null) return
    event.preventDefault()
    trackRef.current?.style.setProperty('--x', String(fraction))
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const tracking = drag.current
    if (!tracking || tracking.pointerId !== event.pointerId) return
    drag.current = null
    if (!tracking.dragging) return

    const fraction = resolveFraction(event.clientX) ?? (activeSide === 'left' ? 0 : 1)
    tryReleaseCapture(event.currentTarget, event.pointerId)
    // Hand position back to the resolved state's attribute-driven value so
    // the spring transition settles from wherever the drag left off.
    trackRef.current?.style.removeProperty('--x')
    setIsDragging(false)
    onSelect(fraction >= 0.5 ? otherState : defaultState)
  }

  // A safety net for when capture is lost mid-drag without a pointerup or
  // pointercancel ever arriving (an interrupted gesture) -- snaps the visual
  // back to the current resolved position rather than leaving the ink
  // frozen mid-track. Deliberately doesn't call onSelect: an aborted drag
  // should leave the stored state exactly as it was.
  function handleLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
    const tracking = drag.current
    if (!tracking || tracking.pointerId !== event.pointerId || !tracking.dragging) return
    drag.current = null
    trackRef.current?.style.removeProperty('--x')
    setIsDragging(false)
  }

  return (
    <div
      ref={trackRef}
      className={isDragging ? 'today-toggle today-toggle-dragging' : 'today-toggle'}
      data-position={activeSide}
      role="radiogroup"
      aria-label="Today"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={handleLostPointerCapture}
    >
      {positions.map((position) => (
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
          {positions.map((position) => (
            <span key={position}>{labels[position]}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
