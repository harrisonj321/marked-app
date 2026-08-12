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
    it('dragging past the midpoint and releasing selects the other state', () => {
      mockTrackRect(320)
      const onSelect = vi.fn()
      render(<TodayToggle state="did" defaultState="did" onSelect={onSelect} />)
      const track = screen.getByRole('radiogroup', { name: 'Today' })

      fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 })
      fireEvent.pointerMove(track, { pointerId: 1, clientX: 250 })
      fireEvent.pointerUp(track, { pointerId: 1, clientX: 250 })

      expect(onSelect).toHaveBeenCalledWith('didnt')
    })

    it('releasing a drag before the midpoint resolves back to the default side', () => {
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
  })
})
