import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TodayToggle } from './TodayToggle'

function mockTrackRect(width: number, left = 0) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 64,
    left,
    right: left + width,
    top: 0,
    bottom: 64,
    x: left,
    y: 0,
    toJSON: () => {},
  })
}

function currentX(track: HTMLElement): string {
  return track.style.getPropertyValue('--x')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TodayToggle', () => {
  it('presents both states with the current one selected', () => {
    render(<TodayToggle state="did" defaultState="did" onSelect={vi.fn()} />)

    expect(screen.getByRole('radiogroup', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Did' })).toBeChecked()
    expect(screen.getByRole('radio', { name: "Didn't" })).not.toBeChecked()
  })

  it('reflects the didnt state symmetrically', () => {
    render(<TodayToggle state="didnt" defaultState="did" onSelect={vi.fn()} />)

    expect(screen.getByRole('radio', { name: "Didn't" })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Did' })).not.toBeChecked()
  })

  it('selecting the other state flips the day', () => {
    const onSelect = vi.fn()
    render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))

    expect(onSelect).toHaveBeenCalledWith('didnt')
  })

  it('flips back in the other direction, reversing an accidental toggle', () => {
    const onSelect = vi.fn()
    render(<TodayToggle state="didnt" defaultState="did" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Did' }))

    expect(onSelect).toHaveBeenCalledWith('did')
  })

  it('tapping the state that is already current does nothing', () => {
    const onSelect = vi.fn()
    render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Did' }))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it("tapping the current state does nothing from the didnt side either", () => {
    const onSelect = vi.fn()
    render(<TodayToggle state="didnt" defaultState="did" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))

    expect(onSelect).not.toHaveBeenCalled()
  })

  // Arrow-key flipping is native browser behavior, but only for radios
  // that share one group name -- which jsdom cannot exercise directly.
  it('puts both options in a single radio group so arrow keys move between them', () => {
    render(<TodayToggle state="did" defaultState="did" onSelect={vi.fn()} />)

    const [did, didnt] = screen.getAllByRole('radio') as HTMLInputElement[]

    expect(did.name).not.toBe('')
    expect(didnt.name).toBe(did.name)
  })

  it('renders custom labels in place of the default Did/Didn\'t wording', () => {
    const onSelect = vi.fn()
    render(
      <TodayToggle
        state="did"
        defaultState="did"
        onSelect={onSelect}
        labels={{ did: 'Took it', didnt: "Didn't take it" }}
      />,
    )

    expect(screen.getByRole('radio', { name: 'Took it' })).toBeChecked()
    expect(screen.getByRole('radio', { name: "Didn't take it" })).not.toBeChecked()

    fireEvent.click(screen.getByRole('radio', { name: "Didn't take it" }))
    expect(onSelect).toHaveBeenCalledWith('didnt')
  })

  describe('ordering by the tracker default', () => {
    it('renders the did default on the left when defaultState is did', () => {
      render(<TodayToggle state="did" defaultState="did" onSelect={vi.fn()} />)

      const [first, second] = screen.getAllByRole('radio') as HTMLInputElement[]
      expect(first).toHaveAttribute('value', 'did')
      expect(second).toHaveAttribute('value', 'didnt')
    })

    it('renders the didnt default on the left when defaultState is didnt', () => {
      render(<TodayToggle state="didnt" defaultState="didnt" onSelect={vi.fn()} />)

      const [first, second] = screen.getAllByRole('radio') as HTMLInputElement[]
      expect(first).toHaveAttribute('value', 'didnt')
      expect(second).toHaveAttribute('value', 'did')
    })

    it('still selects the correct underlying state after reordering', () => {
      const onSelect = vi.fn()
      render(<TodayToggle state="didnt" defaultState="didnt" onSelect={onSelect} />)

      expect(screen.getByRole('radio', { name: "Didn't" })).toBeChecked()
      fireEvent.click(screen.getByRole('radio', { name: 'Did' }))
      expect(onSelect).toHaveBeenCalledWith('did')
    })

    it('marks which side is visually active via data-position, for the CSS position formula', () => {
      const { rerender } = render(<TodayToggle state="did" defaultState="did" onSelect={vi.fn()} />)
      expect(screen.getByRole('radiogroup')).toHaveAttribute('data-position', 'left')

      rerender(<TodayToggle state="didnt" defaultState="did" onSelect={vi.fn()} />)
      expect(screen.getByRole('radiogroup')).toHaveAttribute('data-position', 'right')
    })
  })

  describe('dragging', () => {
    it('tracks the pointer live during the drag, before release', () => {
      mockTrackRect(320)
      const onSelect = vi.fn()
      render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 90 })

      // Still mid-gesture -- no release yet -- but the thumb has already
      // moved to the live pointer position, not just jumped at the end.
      expect(track).toHaveClass('today-toggle-dragging')
      expect(currentX(track)).toBe(String(90 / 320))
      expect(onSelect).not.toHaveBeenCalled()

      fireEvent.pointerMove(track, { pointerId: 1, clientX: 200 })

      expect(currentX(track)).toBe(String(200 / 320))
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('drags left to right and resolves to the right-side state', () => {
      mockTrackRect(320)
      const onSelect = vi.fn()
      render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 250 })
      fireEvent.pointerUp(track, { pointerId: 1, clientX: 250 })

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith('didnt')
      expect(track).not.toHaveClass('today-toggle-dragging')
      expect(currentX(track)).toBe('')
    })

    it('drags right to left and resolves to the left-side state', () => {
      mockTrackRect(320)
      const onSelect = vi.fn()
      render(<TodayToggle state="didnt" defaultState="did" onSelect={onSelect} />)
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      fireEvent.pointerDown(track, { pointerId: 1, clientX: 300 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 220 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 50 })
      fireEvent.pointerUp(track, { pointerId: 1, clientX: 50 })

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith('did')
    })

    it('releasing past the midpoint selects the other state', () => {
      mockTrackRect(320)
      const onSelect = vi.fn()
      render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 250 })
      fireEvent.pointerUp(track, { pointerId: 1, clientX: 250 })

      expect(onSelect).toHaveBeenCalledWith('didnt')
    })

    it('releasing before the midpoint resolves back to the default side', () => {
      mockTrackRect(320)
      const onSelect = vi.fn()
      render(<TodayToggle state="didnt" defaultState="did" onSelect={onSelect} />)
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      fireEvent.pointerDown(track, { pointerId: 1, clientX: 300 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 100 })
      fireEvent.pointerUp(track, { pointerId: 1, clientX: 100 })

      expect(onSelect).toHaveBeenCalledWith('did')
    })

    it('a small pointer movement below the drag threshold is left to the native tap, not treated as a drag', () => {
      mockTrackRect(320)
      const onSelect = vi.fn()
      render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 12 })
      fireEvent.pointerUp(track, { pointerId: 1, clientX: 12 })

      expect(onSelect).not.toHaveBeenCalled()
      expect(track).not.toHaveClass('today-toggle-dragging')
    })

    it('a tap via pointer events, followed by the browser\'s own click, still toggles', () => {
      mockTrackRect(320)
      const onSelect = vi.fn()
      render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      // A real tap's full sequence: pointerdown, pointerup with no
      // meaningful movement, then the browser's own click. Our drag
      // handling must not consume or interfere with any of it.
      fireEvent.pointerDown(track, { pointerId: 1, clientX: 250 })
      fireEvent.pointerUp(track, { pointerId: 1, clientX: 250 })
      fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith('didnt')
    })

    it('a drag gesture on a track with no layout (zero-width rect) is ignored safely', () => {
      const onSelect = vi.fn()
      render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 200 })
      fireEvent.pointerUp(track, { pointerId: 1, clientX: 200 })

      expect(onSelect).not.toHaveBeenCalled()
    })

    it('a completed drag does not also fire a click-triggered toggle', () => {
      mockTrackRect(320)
      const onSelect = vi.fn()
      render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 250 })
      fireEvent.pointerUp(track, { pointerId: 1, clientX: 250 })
      expect(onSelect).toHaveBeenCalledTimes(1)

      // Mobile browsers can still dispatch a synthetic click right after a
      // touch-driven pointerup; simulate the worst case where it lands
      // directly on the radio the drag just landed on.
      fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))

      expect(onSelect).toHaveBeenCalledTimes(1)
    })

    it('a genuine unrelated tap after a completed drag still works', () => {
      mockTrackRect(320)
      const onSelect = vi.fn()
      const { rerender } = render(
        <TodayToggle state="did" defaultState="did" onSelect={onSelect} />,
      )
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 250 })
      fireEvent.pointerUp(track, { pointerId: 1, clientX: 250 })
      expect(onSelect).toHaveBeenCalledTimes(1)

      // The app re-renders with the drag's resolved state before any
      // later, unrelated tap.
      rerender(<TodayToggle state="didnt" defaultState="did" onSelect={onSelect} />)

      // A real tap always starts with its own pointerdown; that's what
      // clears drag-completion suppression left over from the earlier
      // gesture, well before this tap's own click could arrive.
      fireEvent.pointerDown(track, { pointerId: 2, clientX: 10 })
      fireEvent.pointerUp(track, { pointerId: 2, clientX: 10 })
      fireEvent.click(screen.getByRole('radio', { name: 'Did' }))

      expect(onSelect).toHaveBeenCalledTimes(2)
      expect(onSelect).toHaveBeenLastCalledWith('did')
    })

    it('pointercancel ends the drag cleanly without changing the state', () => {
      mockTrackRect(320)
      const onSelect = vi.fn()
      render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 250 })
      expect(track).toHaveClass('today-toggle-dragging')

      fireEvent.pointerCancel(track, { pointerId: 1, clientX: 250 })

      expect(onSelect).not.toHaveBeenCalled()
      expect(track).not.toHaveClass('today-toggle-dragging')
      expect(currentX(track)).toBe('')

      // The session must be fully torn down, not just visually reset -- a
      // later drag has to work normally.
      fireEvent.pointerDown(track, { pointerId: 2, clientX: 10 })
      fireEvent.pointerMove(track, { pointerId: 2, clientX: 250 })
      fireEvent.pointerUp(track, { pointerId: 2, clientX: 250 })

      expect(onSelect).toHaveBeenCalledWith('didnt')
    })

    it('drags correctly even when setPointerCapture throws or is unsupported', () => {
      mockTrackRect(320)
      Element.prototype.setPointerCapture = vi.fn(() => {
        throw new Error('not supported in this environment')
      })

      try {
        const onSelect = vi.fn()
        render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)
        const track = screen.getByRole('radiogroup', { name: 'Today' })

        fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 })
        fireEvent.pointerMove(track, { pointerId: 1, clientX: 250 })

        expect(track).toHaveClass('today-toggle-dragging')
        expect(currentX(track)).toBe(String(250 / 320))

        fireEvent.pointerUp(track, { pointerId: 1, clientX: 250 })

        expect(onSelect).toHaveBeenCalledWith('didnt')
      } finally {
        delete (Element.prototype as { setPointerCapture?: unknown }).setPointerCapture
      }
    })

    it('ignores pointermove and pointerup for an unrelated pointer id', () => {
      mockTrackRect(320)
      const onSelect = vi.fn()
      render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 100 })
      expect(currentX(track)).toBe(String(100 / 320))

      // A second, unrelated pointer must not disturb the active session.
      fireEvent.pointerMove(track, { pointerId: 2, clientX: 300 })
      expect(currentX(track)).toBe(String(100 / 320))
      fireEvent.pointerUp(track, { pointerId: 2, clientX: 300 })
      expect(onSelect).not.toHaveBeenCalled()
      expect(track).toHaveClass('today-toggle-dragging')

      // The original pointer's session is still live and resolves normally.
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 250 })
      fireEvent.pointerUp(track, { pointerId: 1, clientX: 250 })

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith('didnt')
    })

    it('a fresh pointerdown for a new gesture tears down a stuck prior session rather than leaking it', () => {
      mockTrackRect(320)
      const onSelect = vi.fn()
      render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      // Simulate a lost pointerup/cancel: a drag starts but never ends.
      fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 250 })
      expect(track).toHaveClass('today-toggle-dragging')

      // A new gesture begins without the old one ever resolving.
      fireEvent.pointerDown(track, { pointerId: 2, clientX: 10 })
      fireEvent.pointerMove(track, { pointerId: 2, clientX: 250 })
      fireEvent.pointerUp(track, { pointerId: 2, clientX: 250 })

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith('didnt')
    })
  })
})
