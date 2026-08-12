import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
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

interface DragSession {
  pointerId: number
  startX: number
  dragging: boolean
  detach: () => void
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
 *
 * Real mobile Safari does not reliably keep dispatching pointermove to the
 * element a gesture started on -- bubbling and setPointerCapture both
 * proved unable to survive a real on-device drag, even though both work
 * fine in jsdom and in desktop browsers. So a drag session here is tracked
 * with window-level listeners attached imperatively for the lifetime of one
 * pointer's gesture (see handlePointerDown), independent of which element
 * ends up under the finger or whether capture ever takes hold. Capture is
 * still attempted as a free enhancement (it helps a mouse drag that leaves
 * the window), but nothing about correctness depends on it succeeding.
 */
export function TodayToggle({
  state,
  defaultState,
  onSelect,
  labels = DEFAULT_STATE_LABELS,
}: TodayToggleProps) {
  const groupName = useId()
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragSession | null>(null)
  // A completed drag resolves the state itself; the tap-activation click
  // mobile browsers may still dispatch right after touchend would otherwise
  // reach the radio underneath and fire onSelect a second time. Set only
  // while that specific follow-up click could still be pending.
  const suppressNextClick = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  const otherState: DayState = otherDayState(defaultState)
  const positions: readonly DayState[] = [defaultState, otherState]
  const activeSide = state === defaultState ? 'left' : 'right'

  function releaseCaptureIfHeld(target: HTMLDivElement, pointerId: number) {
    try {
      if (target.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture(pointerId)
      }
    } catch {
      // Not supported (e.g. jsdom, or a browser without capture) or already
      // released -- either way there's nothing left to do.
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    // A stale session (its pointerup/cancel was somehow lost) would leak
    // its window listeners forever if a fresh pointerdown just overwrote
    // the ref, so tear it down explicitly before starting the new one.
    drag.current?.detach()
    drag.current = null
    suppressNextClick.current = false

    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return

    const pointerId = event.pointerId
    const startX = event.clientX

    // rect is narrowed non-null above, but that narrowing doesn't survive
    // into this nested function's own body -- TS treats it independently.
    function fraction(clientX: number): number {
      return Math.min(1, Math.max(0, (clientX - rect!.left) / rect!.width))
    }

    function handleWindowPointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return
      const session = drag.current
      if (!session) return

      if (!session.dragging) {
        // Below the threshold this is still a plain tap-in-progress, and a
        // vertical move is left entirely alone so the page can scroll --
        // neither should be swallowed by drag logic.
        if (Math.abs(moveEvent.clientX - startX) < DRAG_THRESHOLD_PX) return
        session.dragging = true
        setIsDragging(true)
      }

      // Only prevented once a horizontal drag is confirmed, so it never
      // blocks the vertical scroll touch-action already leaves available.
      moveEvent.preventDefault()
      trackRef.current?.style.setProperty('--x', String(fraction(moveEvent.clientX)))
    }

    function settle(clientX: number, resolve: boolean) {
      const session = drag.current
      if (!session) return
      session.detach()
      drag.current = null

      const target = trackRef.current
      if (target) releaseCaptureIfHeld(target, pointerId)

      if (!session.dragging) return

      // Hand position back to the resolved state's attribute-driven value
      // so the spring transition settles from wherever the drag left off.
      trackRef.current?.style.removeProperty('--x')
      setIsDragging(false)

      if (resolve) {
        suppressNextClick.current = true
        onSelect(fraction(clientX) >= 0.5 ? otherState : defaultState)
      }
    }

    function handleWindowPointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return
      settle(upEvent.clientX, true)
    }

    function handleWindowPointerCancel(cancelEvent: PointerEvent) {
      if (cancelEvent.pointerId !== pointerId) return
      // An interrupted gesture leaves the stored state exactly as it was.
      settle(cancelEvent.clientX, false)
    }

    function detach() {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerCancel)
    }

    drag.current = { pointerId, startX, dragging: false, detach }

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false })
    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointercancel', handleWindowPointerCancel)

    // Best-effort only: a control that *depended* on this succeeding is
    // exactly the fragility that broke dragging on real mobile Safari. The
    // window listeners above are what actually keep the gesture alive
    // whether or not this is honored.
    try {
      event.currentTarget.setPointerCapture?.(pointerId)
    } catch {
      // ignore -- see above
    }
  }

  // Swallows the single click a completed drag may still trigger on the
  // radio underneath, so it can't fire onSelect a second time. Runs in the
  // capture phase so it reaches the div before the label/input do.
  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressNextClick.current) return
    suppressNextClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  // Unmounting mid-drag (e.g. navigating away) must not leave window
  // listeners attached forever.
  useEffect(() => {
    return () => {
      drag.current?.detach()
      drag.current = null
    }
  }, [])

  return (
    <div
      ref={trackRef}
      className={isDragging ? 'today-toggle today-toggle-dragging' : 'today-toggle'}
      data-position={activeSide}
      data-tour-id="today-toggle"
      role="radiogroup"
      aria-label="Today"
      onPointerDown={handlePointerDown}
      onClickCapture={handleClickCapture}
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
