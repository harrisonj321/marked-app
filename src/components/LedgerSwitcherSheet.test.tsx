import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LedgerSwitcherSheet, type NewLedgerInput } from './LedgerSwitcherSheet'
import type { Ledger } from '../domain/ledger'

const LEDGERS: Ledger[] = [
  { id: 'a', name: 'Worked out', defaultState: 'did', timezone: 'UTC', startDate: '2026-01-01', color: 'clay' },
  { id: 'b', name: 'Drinking', defaultState: 'didnt', timezone: 'UTC', startDate: '2026-01-01' },
]

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  })
})

function renderSheet(overrides: Partial<Parameters<typeof LedgerSwitcherSheet>[0]> = {}) {
  const onSwitch = vi.fn()
  const onCreate = vi.fn<(input: NewLedgerInput) => Promise<void>>().mockResolvedValue(undefined)
  const onRename = vi.fn().mockResolvedValue(undefined)
  const onRecolor = vi.fn().mockResolvedValue(undefined)
  const onDelete = vi.fn().mockResolvedValue(undefined)
  const onDismiss = vi.fn()
  render(
    <LedgerSwitcherSheet
      ledgers={LEDGERS}
      activeLedgerId="a"
      onSwitch={onSwitch}
      onCreate={onCreate}
      onRename={onRename}
      onRecolor={onRecolor}
      onDelete={onDelete}
      onDismiss={onDismiss}
      {...overrides}
    />,
  )
  return { onSwitch, onCreate, onRename, onRecolor, onDelete, onDismiss }
}

describe('LedgerSwitcherSheet', () => {
  it('opens as a modal listing every ledger', () => {
    renderSheet()
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Worked out' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drinking' })).toBeInTheDocument()
  })

  it('marks the active ledger with aria-current', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Worked out' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Drinking' })).not.toHaveAttribute('aria-current')
  })

  it('shows a color indicator only for a ledger that has one', () => {
    renderSheet()
    const rows = screen.getAllByRole('listitem')
    expect(rows[0].querySelector('.ledger-dot')).toBeInTheDocument()
    expect(rows[1].querySelector('.ledger-dot')).not.toBeInTheDocument()
  })

  it('offers a quiet manage control per row, not a prominent Delete', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Manage Worked out' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Manage Drinking' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
  })

  it('switching to a different ledger closes the sheet', () => {
    const { onSwitch, onDismiss } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Drinking' }))
    expect(onSwitch).toHaveBeenCalledWith('b')
    expect(onDismiss).toHaveBeenCalled()
  })

  it('tapping the already-active ledger just closes without switching', () => {
    const { onSwitch, onDismiss } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Worked out' }))
    expect(onSwitch).not.toHaveBeenCalled()
    expect(onDismiss).toHaveBeenCalled()
  })

  it('dismisses via the close control without switching', () => {
    const { onSwitch, onDismiss } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onDismiss).toHaveBeenCalled()
    expect(onSwitch).not.toHaveBeenCalled()
  })

  describe('manage / edit', () => {
    it('opens the edit view pre-filled with the ledger\'s current name and color, without switching', () => {
      const { onSwitch } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))

      expect(screen.getByDisplayValue('Worked out')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Clay' })).toHaveAttribute('aria-pressed', 'true')
      expect(onSwitch).not.toHaveBeenCalled()
    })

    it('cancel collapses the edit view without saving', () => {
      const { onRename } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))
      fireEvent.change(screen.getByDisplayValue('Worked out'), { target: { value: 'Something else' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onRename).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Worked out' })).toBeInTheDocument()
    })

    it('saves a renamed ledger', async () => {
      const { onRename } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))
      fireEvent.change(screen.getByDisplayValue('Worked out'), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onRename).toHaveBeenCalledWith('a', 'Reading')
      })
    })

    it('saves a recolored ledger', async () => {
      const { onRecolor } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))
      fireEvent.click(screen.getByRole('button', { name: 'Moss' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onRecolor).toHaveBeenCalledWith('a', 'moss')
      })
    })

    it('saves name and color together in one submit', async () => {
      const { onRename, onRecolor } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))
      fireEvent.change(screen.getByDisplayValue('Worked out'), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('button', { name: 'Moss' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onRename).toHaveBeenCalledWith('a', 'Reading')
        expect(onRecolor).toHaveBeenCalledWith('a', 'moss')
      })
    })

    it('saves nothing when submitted unchanged', async () => {
      const { onRename, onRecolor } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(screen.getByRole('button', { name: 'Worked out' })).toBeInTheDocument()
      })
      expect(onRename).not.toHaveBeenCalled()
      expect(onRecolor).not.toHaveBeenCalled()
    })

    it('rejects an emptied name and does not save', async () => {
      const { onRename } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))
      fireEvent.change(screen.getByDisplayValue('Worked out'), { target: { value: '   ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/enter a name/i)
      expect(onRename).not.toHaveBeenCalled()
    })

    it('shows an error and stays open when saving fails', async () => {
      const onRename = vi.fn().mockRejectedValue(new Error('offline'))
      renderSheet({ onRename })

      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))
      fireEvent.change(screen.getByDisplayValue('Worked out'), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.')
      expect(screen.getByDisplayValue('Reading')).toBeInTheDocument()
    })
  })

  describe('delete', () => {
    it('is reached from inside the manage view, requiring a confirm tap before deleting', () => {
      const { onDelete } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

      expect(onDelete).not.toHaveBeenCalled()
      expect(screen.getByText(/Delete "Worked out" and its history\?/)).toBeInTheDocument()
    })

    it('cancel reverts to the edit view without deleting', () => {
      const { onDelete } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onDelete).not.toHaveBeenCalled()
      expect(screen.queryByText(/and its history/)).not.toBeInTheDocument()
      expect(screen.getByDisplayValue('Worked out')).toBeInTheDocument()
    })

    it('confirming deletes the ledger', async () => {
      const { onDelete } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete Worked out forever' }))

      await vi.waitFor(() => {
        expect(onDelete).toHaveBeenCalledWith('a')
      })
    })

    it('allows deleting the only remaining ledger, for the safe-fallback flow', () => {
      renderSheet({ ledgers: [LEDGERS[0]] })
      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it('shows an error and stays in the confirm state when deletion fails', async () => {
      const onDelete = vi.fn().mockRejectedValue(new Error('offline'))
      renderSheet({ onDelete })

      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete Worked out forever' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete. Try again.')
      expect(screen.getByText(/and its history/)).toBeInTheDocument()
    })
  })

  describe('create', () => {
    it('reveals the new-ledger form on demand', () => {
      renderSheet()
      expect(screen.queryByLabelText(/what are you tracking/i)).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      expect(screen.getByLabelText(/what are you tracking/i)).toBeInTheDocument()
    })

    it('cancel collapses the form without creating', () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onCreate).not.toHaveBeenCalled()
      expect(screen.queryByLabelText(/what are you tracking/i)).not.toBeInTheDocument()
    })

    it('rejects an empty name', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.click(screen.getByRole('radio', { name: 'I did it' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/enter a name/i)
      expect(onCreate).not.toHaveBeenCalled()
    })

    it('requires a default-state selection', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/choose what an untouched day means/i)
      expect(onCreate).not.toHaveBeenCalled()
    })

    it('creates with no color by default', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('radio', { name: "I didn't do it" }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith({ name: 'Reading', defaultState: 'didnt', color: null })
      })
    })

    it('creates with a chosen color', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('radio', { name: 'I did it' }))
      fireEvent.click(screen.getByRole('button', { name: 'Moss' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith({ name: 'Reading', defaultState: 'did', color: 'moss' })
      })
    })

    it('closes the sheet after a successful create', async () => {
      const { onDismiss } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('radio', { name: 'I did it' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onDismiss).toHaveBeenCalled()
      })
    })

    it('shows an error and keeps the form open when creation fails', async () => {
      const onCreate = vi.fn().mockRejectedValue(new Error('offline'))
      renderSheet({ onCreate })

      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('radio', { name: 'I did it' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.')
      expect(screen.getByLabelText(/what are you tracking/i)).toBeInTheDocument()
    })
  })
})
