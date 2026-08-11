import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TodayToggle } from './TodayToggle'

describe('TodayToggle', () => {
  it('presents both states with the current one selected', () => {
    render(<TodayToggle state="did" onSelect={vi.fn()} />)

    expect(screen.getByRole('radiogroup', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Did' })).toBeChecked()
    expect(screen.getByRole('radio', { name: "Didn't" })).not.toBeChecked()
  })

  it('reflects the didnt state symmetrically', () => {
    render(<TodayToggle state="didnt" onSelect={vi.fn()} />)

    expect(screen.getByRole('radio', { name: "Didn't" })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Did' })).not.toBeChecked()
  })

  it('selecting the other state flips the day', () => {
    const onSelect = vi.fn()
    render(<TodayToggle state="did" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))

    expect(onSelect).toHaveBeenCalledWith('didnt')
  })

  it('flips back in the other direction, reversing an accidental toggle', () => {
    const onSelect = vi.fn()
    render(<TodayToggle state="didnt" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Did' }))

    expect(onSelect).toHaveBeenCalledWith('did')
  })

  it('tapping the state that is already current does nothing', () => {
    const onSelect = vi.fn()
    render(<TodayToggle state="did" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Did' }))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it("tapping the current state does nothing from the didnt side either", () => {
    const onSelect = vi.fn()
    render(<TodayToggle state="didnt" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))

    expect(onSelect).not.toHaveBeenCalled()
  })

  // Arrow-key flipping is native browser behavior, but only for radios
  // that share one group name -- which jsdom cannot exercise directly.
  it('puts both options in a single radio group so arrow keys move between them', () => {
    render(<TodayToggle state="did" onSelect={vi.fn()} />)

    const [did, didnt] = screen.getAllByRole('radio') as HTMLInputElement[]

    expect(did.name).not.toBe('')
    expect(didnt.name).toBe(did.name)
  })
})
