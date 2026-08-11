import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const toggle = vi.fn()
let mockRecord: { state?: 'did' | 'didnt'; note?: string; count?: number } = {}

vi.mock('../hooks/useTodayState', () => ({
  useTodayState: () => ({
    dateKey: '2026-08-10',
    effectiveState: 'did' as const,
    record: mockRecord,
    pending: false,
    error: null,
    toggle,
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
  saveDailyRecordMock.mockClear()
})

const { TodaySection } = await import('./TodaySection')

describe('TodaySection', () => {
  it("the primary control shows today's effective state", () => {
    render(<TodaySection uid="u1" defaultState="did" timezone="UTC" />)
    expect(screen.getByText('Did')).toBeInTheDocument()
  })

  it('the primary control names the flip action it will take and calls toggle', () => {
    render(<TodaySection uid="u1" defaultState="did" timezone="UTC" />)
    fireEvent.click(screen.getByRole('button', { name: /mark today as "didn't"/i }))
    expect(toggle).toHaveBeenCalled()
  })

  it('shows "Add note" when there is no existing note or count', () => {
    render(<TodaySection uid="u1" defaultState="did" timezone="UTC" />)
    expect(screen.getByRole('button', { name: 'Add note' })).toBeInTheDocument()
  })

  it('shows "Edit note" when a note already exists', () => {
    mockRecord = { note: 'Hotel gym' }
    render(<TodaySection uid="u1" defaultState="did" timezone="UTC" />)
    expect(screen.getByRole('button', { name: 'Edit note' })).toBeInTheDocument()
  })

  it('shows "Add note" when only a count exists without a note', () => {
    mockRecord = { count: 3 }
    render(<TodaySection uid="u1" defaultState="did" timezone="UTC" />)
    expect(screen.getByRole('button', { name: 'Add note' })).toBeInTheDocument()
  })

  it('opens the detail surface pre-filled with the current record', () => {
    mockRecord = { note: 'Hotel gym', count: 3 }
    render(<TodaySection uid="u1" defaultState="did" timezone="UTC" />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit note' }))
    expect(screen.getByLabelText('Note')).toHaveValue('Hotel gym')
    expect(screen.getByRole('button', { name: '3×' })).toHaveAttribute('aria-pressed', 'true')
  })

  it("today's note sheet does not duplicate the Did/Didn't controls", () => {
    render(<TodaySection uid="u1" defaultState="did" timezone="UTC" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('saving from the detail surface persists via saveDailyRecord for today', async () => {
    render(<TodaySection uid="u1" defaultState="did" timezone="UTC" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Sick' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(saveDailyRecordMock).toHaveBeenCalledWith('u1', '2026-08-10', {
        kind: 'set',
        note: 'Sick',
      })
    })
  })
})
