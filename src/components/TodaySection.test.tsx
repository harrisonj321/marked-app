import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const setState = vi.fn()
let mockRecord: { state?: 'did' | 'didnt'; note?: string; count?: number } = {}
let mockPending = false
let mockError: string | null = null

vi.mock('../hooks/useTodayState', () => ({
  useTodayState: () => ({
    dateKey: '2026-08-10',
    effectiveState: 'did' as const,
    record: mockRecord,
    pending: mockPending,
    error: mockError,
    setState,
  }),
}))

const saveDailyRecordMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../data/day', () => ({
  saveDailyRecord: (...args: unknown[]) => saveDailyRecordMock(...args),
}))

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  })
  mockRecord = {}
  mockPending = false
  mockError = null
  setState.mockClear()
  saveDailyRecordMock.mockClear()
})

const { TodaySection } = await import('./TodaySection')

describe('TodaySection', () => {
  it("presents both states with today's state selected", () => {
    render(<TodaySection uid="u1" ledgerId="ledger-1" defaultState="did" timezone="UTC" />)
    expect(screen.getByRole('radio', { name: 'Did' })).toBeChecked()
    expect(screen.getByRole('radio', { name: "Didn't" })).not.toBeChecked()
  })

  it('selecting the other state flips today', () => {
    render(<TodaySection uid="u1" ledgerId="ledger-1" defaultState="did" timezone="UTC" />)
    fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))
    expect(setState).toHaveBeenCalledWith('didnt')
  })

  it('shows "Add note" when there is no existing note or count', () => {
    render(<TodaySection uid="u1" ledgerId="ledger-1" defaultState="did" timezone="UTC" />)
    expect(screen.getByRole('button', { name: 'Add note' })).toBeInTheDocument()
  })

  it('shows "Edit note" when a note already exists', () => {
    mockRecord = { note: 'Hotel gym' }
    render(<TodaySection uid="u1" ledgerId="ledger-1" defaultState="did" timezone="UTC" />)
    expect(screen.getByRole('button', { name: 'Edit note' })).toBeInTheDocument()
  })

  it('shows "Add note" when only a count exists without a note', () => {
    mockRecord = { count: 3 }
    render(<TodaySection uid="u1" ledgerId="ledger-1" defaultState="did" timezone="UTC" />)
    expect(screen.getByRole('button', { name: 'Add note' })).toBeInTheDocument()
  })

  it('opens the detail surface pre-filled with the current record', () => {
    mockRecord = { note: 'Hotel gym', count: 3 }
    render(<TodaySection uid="u1" ledgerId="ledger-1" defaultState="did" timezone="UTC" />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit note' }))
    expect(screen.getByLabelText('Note')).toHaveValue('Hotel gym')
    expect(screen.getByRole('button', { name: '3×' })).toHaveAttribute('aria-pressed', 'true')
  })

  it("today's note sheet does not duplicate the Did/Didn't controls", () => {
    render(<TodaySection uid="u1" ledgerId="ledger-1" defaultState="did" timezone="UTC" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))
    // The only radios on screen remain the two in the primary toggle.
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('renders custom labels when provided', () => {
    render(
      <TodaySection
        uid="u1"
        ledgerId="ledger-1"
        defaultState="did"
        timezone="UTC"
        labels={{ did: 'Took it', didnt: "Didn't take it" }}
      />,
    )
    expect(screen.getByRole('radio', { name: 'Took it' })).toBeChecked()
    expect(screen.getByRole('radio', { name: "Didn't take it" })).not.toBeChecked()
  })

  it('keeps the save-status slot mounted at rest, with nothing visible', () => {
    render(<TodaySection uid="u1" ledgerId="ledger-1" defaultState="did" timezone="UTC" />)
    const status = document.querySelector('.today-status')
    expect(status).toBeInTheDocument()
    expect(status?.querySelectorAll('.today-status-text')).toHaveLength(2)
    expect(status?.querySelector('.today-status-text-visible')).not.toBeInTheDocument()
  })

  it('reveals "Saving…" in the reserved slot without unmounting it, while pending', () => {
    mockPending = true
    render(<TodaySection uid="u1" ledgerId="ledger-1" defaultState="did" timezone="UTC" />)
    const status = document.querySelector('.today-status')
    expect(status).toHaveTextContent('Saving…')
    expect(status?.querySelector('[aria-live="polite"]')).toHaveClass('today-status-text-visible')
  })

  it('reveals an error in the reserved slot as an alert, without unmounting the slot', () => {
    mockError = 'Could not save. Try again.'
    render(<TodaySection uid="u1" ledgerId="ledger-1" defaultState="did" timezone="UTC" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save. Try again.')
    expect(screen.getByRole('alert')).toHaveClass('today-status-text-visible')
  })

  it('the toggle and Add note stay adjacent to the same status slot regardless of save state', () => {
    const { rerender } = render(
      <TodaySection uid="u1" ledgerId="ledger-1" defaultState="did" timezone="UTC" />,
    )
    const section = document.querySelector('.today')
    const childClasses = () => Array.from(section?.children ?? []).map((el) => el.className)

    const atRest = childClasses()
    mockPending = true
    rerender(<TodaySection uid="u1" ledgerId="ledger-1" defaultState="did" timezone="UTC" />)
    expect(childClasses()).toEqual(atRest)
  })

  it('saving from the detail surface persists via saveDailyRecord for today, scoped to the ledger', async () => {
    render(<TodaySection uid="u1" ledgerId="ledger-1" defaultState="did" timezone="UTC" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Sick' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(saveDailyRecordMock).toHaveBeenCalledWith('u1', 'ledger-1', '2026-08-10', {
        kind: 'set',
        note: 'Sick',
      })
    })
  })
})
