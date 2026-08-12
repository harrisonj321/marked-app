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

  it('pre-fills state and note from the initial record', () => {
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
    expect(screen.getByLabelText('Note')).toHaveValue('Sick')
    // Count is only shown when the effective state is "did".
    expect(screen.queryByRole('group', { name: 'Count' })).not.toBeInTheDocument()
  })

  it('shows the count selector only when the state is Did', () => {
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{}}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('group', { name: 'Count' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))
    expect(screen.queryByRole('group', { name: 'Count' })).not.toBeInTheDocument()
  })

  it('a normal single occurrence requires no count selection', () => {
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{}}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '2×' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '3×' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Other' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByLabelText('Custom count')).not.toBeInTheDocument()
  })

  it('selecting 2x stores count 2', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{}}
        onSave={onSave}
        onDismiss={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '2×' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ kind: 'set', count: 2 })
    })
  })

  it('selecting 3x stores count 3', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{}}
        onSave={onSave}
        onDismiss={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '3×' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ kind: 'set', count: 3 })
    })
  })

  it('tapping an already-selected chip returns to the normal single occurrence', () => {
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{ count: 2 }}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '2×' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '2×' }))
    expect(screen.getByRole('button', { name: '2×' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('selecting Other reveals a numeric input and stores the entered count', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{}}
        onSave={onSave}
        onDismiss={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Other' }))
    expect(screen.getByLabelText('Custom count')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Custom count'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ kind: 'set', count: 7 })
    })
  })

  it('rejects an Other value below the minimum and does not save', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Other' }))
    fireEvent.change(screen.getByLabelText('Custom count'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/enter a number 4 or greater/i)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('loads an existing non-2/non-3 count into Other, pre-filled', () => {
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{ count: 9 }}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Other' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Custom count')).toHaveValue(9)
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
    fireEvent.click(screen.getByRole('button', { name: '3×' }))
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: '  Hotel gym  ' } })
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

    fireEvent.change(screen.getByLabelText('Note'), {
      target: { value: 'a'.repeat(200) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/keep it under/i)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('hides the state control when editableState is false', () => {
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{}}
        editableState={false}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('saves using the fixed effective state when editableState is false', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{ state: 'didnt' }}
        editableState={false}
        onSave={onSave}
        onDismiss={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Sick' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ kind: 'set', state: 'didnt', note: 'Sick' })
    })
  })

  it('renders custom labels in place of the default Did/Didn\'t wording', () => {
    render(
      <DayDetail
        dateKey="2026-08-10"
        defaultState="did"
        initialRecord={{}}
        labels={{ did: 'Took it', didnt: "Didn't take it" }}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('radio', { name: 'Took it' })).toBeChecked()
    expect(screen.getByRole('radio', { name: "Didn't take it" })).not.toBeChecked()
  })

  it('calls onDismiss when the dialog is closed via the close control', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
