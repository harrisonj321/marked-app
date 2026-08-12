import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

let mockRecords = new Map<string, { state?: 'did' | 'didnt'; note?: string; count?: number }>()
let mockError: string | null = null

vi.mock('../hooks/useMonthRecords', () => ({
  useMonthRecords: () => ({ records: mockRecords, loading: false, error: mockError }),
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
  mockRecords = new Map()
  mockError = null
  saveDailyRecordMock.mockClear()
})

const { Calendar } = await import('./Calendar')

const tracker = {
  name: 'Worked out',
  defaultState: 'did' as const,
  timezone: 'UTC',
  startDate: '2026-08-01',
}

describe('Calendar', () => {
  it('shows the current month by default with next-month navigation disabled', () => {
    render(<Calendar uid="u1" tracker={tracker} todayKey="2026-08-15" />)
    expect(screen.getByText('August 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
  })

  it('navigates to the previous month and re-enables next month', () => {
    render(<Calendar uid="u1" tracker={tracker} todayKey="2026-08-15" />)
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('July 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next month' })).not.toBeDisabled()
  })

  it('does not navigate past the current month', () => {
    render(<Calendar uid="u1" tracker={tracker} todayKey="2026-08-15" />)
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByText('August 2026')).toBeInTheDocument()
  })

  it('future days are not interactive', () => {
    render(<Calendar uid="u1" tracker={tracker} todayKey="2026-08-15" />)
    expect(
      screen.queryByRole('button', { name: /08\/20\/2026/ }),
    ).not.toBeInTheDocument()
  })

  it('days before the tracker start date are not interactive', () => {
    render(<Calendar uid="u1" tracker={tracker} todayKey="2026-08-15" />)
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(
      screen.queryByRole('button', { name: /07\/15\/2026/ }),
    ).not.toBeInTheDocument()
  })

  it('an active default-state day is labeled but not specially marked', () => {
    render(<Calendar uid="u1" tracker={tracker} todayKey="2026-08-15" />)
    const cell = screen.getByRole('button', { name: /08\/10\/2026, Did/ })
    expect(cell.className).not.toContain('calendar-cell-marked')
  })

  it('a non-default override is neutrally marked', () => {
    mockRecords = new Map([['2026-08-10', { state: 'didnt' }]])
    render(<Calendar uid="u1" tracker={tracker} todayKey="2026-08-15" />)
    const cell = screen.getByRole('button', { name: /08\/10\/2026, Didn't/ })
    expect(cell.className).toContain('calendar-cell-marked')
  })

  it('uses the tracker\'s configured labels in day aria-labels', () => {
    render(
      <Calendar
        uid="u1"
        tracker={{ ...tracker, stateLabels: { did: 'Took it', didnt: "Didn't take it" } }}
        todayKey="2026-08-15"
      />,
    )
    expect(screen.getByRole('button', { name: /08\/10\/2026, Took it/ })).toBeInTheDocument()
  })

  it("today's cell is identifiable independent of its state", () => {
    render(<Calendar uid="u1" tracker={tracker} todayKey="2026-08-15" />)
    expect(screen.getByRole('button', { name: /Today/ })).toHaveAttribute(
      'aria-current',
      'date',
    )
  })

  it('a day with a note shows a subtle indicator, not the note text', () => {
    mockRecords = new Map([['2026-08-10', { note: 'Hotel gym' }]])
    render(<Calendar uid="u1" tracker={tracker} todayKey="2026-08-15" />)
    expect(screen.queryByText('Hotel gym')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /has a note/ })).toBeInTheDocument()
  })

  it('a count greater than one is shown compactly', () => {
    mockRecords = new Map([['2026-08-10', { count: 3 }]])
    render(<Calendar uid="u1" tracker={tracker} todayKey="2026-08-15" />)
    expect(screen.getByText('3×')).toBeInTheDocument()
  })

  it('selecting an eligible day opens the detail surface pre-filled with its record', () => {
    mockRecords = new Map([['2026-08-10', { state: 'didnt', note: 'Sick' }]])
    render(<Calendar uid="u1" tracker={tracker} todayKey="2026-08-15" />)
    fireEvent.click(screen.getByRole('button', { name: /08\/10\/2026/ }))
    expect(screen.getByRole('radio', { name: "Didn't" })).toBeChecked()
    expect(screen.getByLabelText('Note')).toHaveValue('Sick')
  })

  it('the detail surface uses the configured labels when a day is selected', () => {
    mockRecords = new Map([['2026-08-10', { state: 'didnt' }]])
    render(
      <Calendar
        uid="u1"
        tracker={{ ...tracker, stateLabels: { did: 'Took it', didnt: "Didn't take it" } }}
        todayKey="2026-08-15"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /08\/10\/2026/ }))
    expect(screen.getByRole('radio', { name: "Didn't take it" })).toBeChecked()
  })

  it('saving from the detail surface persists via saveDailyRecord for the selected day', async () => {
    render(<Calendar uid="u1" tracker={tracker} todayKey="2026-08-15" />)
    fireEvent.click(screen.getByRole('button', { name: /08\/10\/2026/ }))
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Wedding' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(saveDailyRecordMock).toHaveBeenCalledWith('u1', '2026-08-10', {
        kind: 'set',
        note: 'Wedding',
      })
    })
  })
})
