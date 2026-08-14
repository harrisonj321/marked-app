import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('./Calendar', () => ({
  Calendar: ({ todayKey }: { todayKey: string }) => (
    <div data-testid="calendar">calendar:{todayKey}</div>
  ),
}))

const { CalendarSheet } = await import('./CalendarSheet')

const ledger = {
  id: 'ledger-1',
  name: 'Worked out',
  defaultState: 'did' as const,
  timezone: 'UTC',
  startDate: '2026-08-01',
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  })
})

describe('CalendarSheet', () => {
  it('opens as a modal containing the calendar', () => {
    render(
      <CalendarSheet uid="u1" ledger={ledger} todayKey="2026-08-10" onDismiss={vi.fn()} />,
    )

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
    expect(screen.getByTestId('calendar')).toHaveTextContent('calendar:2026-08-10')
  })

  it('dismisses via the close control', () => {
    const onDismiss = vi.fn()
    render(
      <CalendarSheet uid="u1" ledger={ledger} todayKey="2026-08-10" onDismiss={onDismiss} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close calendar' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
