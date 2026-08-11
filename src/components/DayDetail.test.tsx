import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DayDetail } from './DayDetail'

beforeEach(() => {
  // jsdom does not implement <dialog> interactivity; stub the native methods
  // the component relies on so behavior above that layer can be tested.
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  })
})

describe('DayDetail', () => {
  it('opens the dialog on mount and defaults the state to the tracker default', () => {
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{}}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: 'Did' })).toBeChecked()
    expect(screen.getByText('08/10/2026')).toBeInTheDocument()
  })

  it('pre-fills state, note, and count from the initial record', () => {
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{ state: 'didnt', note: 'Sick' }}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('radio', { name: "Didn't" })).toBeChecked()
    expect(screen.getByLabelText('Add note')).toHaveValue('Sick')
    // Count is only shown when the effective state is "did".
    expect(screen.queryByLabelText('Count')).not.toBeInTheDocument()
  })

  it('shows the count field only when the state is Did', () => {
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{}}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Count')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))
    expect(screen.queryByLabelText('Count')).not.toBeInTheDocument()
  })

  it('saves a normalized record combining state, note, and count', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="didnt"
        initialRecord={{}}
        onSave={onSave}
        onDismiss={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Did' }))
    fireEvent.change(screen.getByLabelText('Count'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Add note'), { target: { value: '  Hotel gym  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        kind: 'set',
        state: 'did',
        note: 'Hotel gym',
        count: 3,
      })
    })
  })

  it('rejects an invalid count and does not save', async () => {
    const onSave = vi.fn()
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{}}
        onSave={onSave}
        onDismiss={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Count'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/enter a number from/i)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('rejects a note over the length limit and does not save', async () => {
    const onSave = vi.fn()
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{}}
        onSave={onSave}
        onDismiss={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Add note'), {
      target: { value: 'a'.repeat(200) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/keep it under/i)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onDismiss when the dialog is closed via Cancel', () => {
    const onDismiss = vi.fn()
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{}}
        onSave={vi.fn()}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
