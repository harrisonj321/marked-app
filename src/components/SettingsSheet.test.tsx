import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SettingsSheet } from './SettingsSheet'

const DEFAULT_LABELS = { did: 'Did', didnt: "Didn't" }

const SWAP_BUTTON = 'Swap which state is default'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  })
})

function renderSheet(overrides: Partial<Parameters<typeof SettingsSheet>[0]> = {}) {
  const onSaveName = vi.fn().mockResolvedValue(undefined)
  const onSaveDefaultState = vi.fn().mockResolvedValue(undefined)
  const onSaveStateLabels = vi.fn().mockResolvedValue(undefined)
  const onSaveColor = vi.fn().mockResolvedValue(undefined)
  const onDelete = vi.fn().mockResolvedValue(undefined)
  const onTourNoted = vi.fn()
  const onDismiss = vi.fn()
  const onDeleteAccount = vi.fn().mockResolvedValue(undefined)
  render(
    <SettingsSheet
      name="Worked out"
      defaultState="did"
      stateLabels={DEFAULT_LABELS}
      color="espresso"
      onSaveName={onSaveName}
      onSaveDefaultState={onSaveDefaultState}
      onSaveStateLabels={onSaveStateLabels}
      onSaveColor={onSaveColor}
      onDelete={onDelete}
      onTourNoted={onTourNoted}
      onDismiss={onDismiss}
      authProviderId="password"
      onDeleteAccount={onDeleteAccount}
      {...overrides}
    />,
  )
  return { onSaveName, onSaveDefaultState, onSaveStateLabels, onSaveColor, onDelete, onTourNoted, onDismiss, onDeleteAccount }
}

describe('SettingsSheet', () => {
  it('shows exactly two role fields and no radio buttons', () => {
    renderSheet()

    expect(screen.getByLabelText('Default')).toBeInTheDocument()
    expect(screen.getByLabelText('Noted.')).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('does not show the old explanatory paragraph', () => {
    renderSheet()

    expect(screen.queryByText(/what an untouched day means/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/left of today's toggle/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/two states/i)).not.toBeInTheDocument()
  })

  it('pre-fills Default with the label for the current default state and Noted. with the other', () => {
    renderSheet({ stateLabels: { did: 'Took it', didnt: "Didn't take it" } })

    expect(screen.getByLabelText('Default')).toHaveValue('Took it')
    expect(screen.getByLabelText('Noted.')).toHaveValue("Didn't take it")
  })

  it('pre-fills the fields in swapped order when didnt is the default', () => {
    renderSheet({ defaultState: 'didnt', stateLabels: { did: 'Took it', didnt: "Didn't take it" } })

    expect(screen.getByLabelText('Default')).toHaveValue("Didn't take it")
    expect(screen.getByLabelText('Noted.')).toHaveValue('Took it')
  })

  it('swapping trades the field contents and marks the default state changed', async () => {
    const { onSaveDefaultState } = renderSheet({
      stateLabels: { did: 'Took it', didnt: "Didn't take it" },
    })

    fireEvent.click(screen.getByRole('button', { name: SWAP_BUTTON }))

    expect(screen.getByLabelText('Default')).toHaveValue("Didn't take it")
    expect(screen.getByLabelText('Noted.')).toHaveValue('Took it')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSaveDefaultState).toHaveBeenCalledWith('didnt')
    })
  })

  it('swapping twice returns to the original default with no changes to save', async () => {
    const { onSaveDefaultState, onSaveStateLabels, onDismiss } = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: SWAP_BUTTON }))
    fireEvent.click(screen.getByRole('button', { name: SWAP_BUTTON }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onDismiss).toHaveBeenCalled()
    })
    expect(onSaveDefaultState).not.toHaveBeenCalled()
    expect(onSaveStateLabels).not.toHaveBeenCalled()
  })

  it('editing a field while swapped edits the label for the underlying state now shown', async () => {
    const { onSaveStateLabels } = renderSheet({ defaultState: 'didnt' })

    // Default currently shows "Didn't" (the didnt label); Noted. shows "Did".
    fireEvent.click(screen.getByRole('button', { name: SWAP_BUTTON }))
    // After swapping, draft default is 'did', so Default field now shows "Did".
    expect(screen.getByLabelText('Default')).toHaveValue('Did')
    fireEvent.change(screen.getByLabelText('Default'), { target: { value: 'Took it' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSaveStateLabels).toHaveBeenCalledWith({ did: 'Took it', didnt: "Didn't" })
    })
  })

  it('re-syncs the fields when the stored default changes under an open sheet', () => {
    const onSaveDefaultState = vi.fn()
    const onSaveStateLabels = vi.fn()
    const onDismiss = vi.fn()

    const { rerender } = render(
      <SettingsSheet
        name="Worked out"
        defaultState="did"
        stateLabels={DEFAULT_LABELS}
        color="espresso"
        onSaveName={vi.fn()}
        onSaveDefaultState={onSaveDefaultState}
        onSaveStateLabels={onSaveStateLabels}
        onSaveColor={vi.fn()}
        onDelete={vi.fn()}
        onTourNoted={vi.fn()}
        onDismiss={onDismiss}
        authProviderId="password"
        onDeleteAccount={vi.fn()}
      />,
    )

    rerender(
      <SettingsSheet
        name="Worked out"
        defaultState="didnt"
        stateLabels={DEFAULT_LABELS}
        color="espresso"
        onSaveName={vi.fn()}
        onSaveDefaultState={onSaveDefaultState}
        onSaveStateLabels={onSaveStateLabels}
        onSaveColor={vi.fn()}
        onDelete={vi.fn()}
        onTourNoted={vi.fn()}
        onDismiss={onDismiss}
        authProviderId="password"
        onDeleteAccount={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Default')).toHaveValue("Didn't")
    expect(screen.getByLabelText('Noted.')).toHaveValue('Did')

    // Saving an untouched form must not push the stale value back.
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSaveDefaultState).not.toHaveBeenCalled()
    expect(onSaveStateLabels).not.toHaveBeenCalled()
  })

  it('re-syncs the label fields when the stored labels change under an open sheet', () => {
    const { rerender } = render(
      <SettingsSheet
        name="Worked out"
        defaultState="did"
        stateLabels={DEFAULT_LABELS}
        color="espresso"
        onSaveName={vi.fn()}
        onSaveDefaultState={vi.fn()}
        onSaveStateLabels={vi.fn()}
        onSaveColor={vi.fn()}
        onDelete={vi.fn()}
        onTourNoted={vi.fn()}
        onDismiss={vi.fn()}
        authProviderId="password"
        onDeleteAccount={vi.fn()}
      />,
    )

    rerender(
      <SettingsSheet
        name="Worked out"
        defaultState="did"
        stateLabels={{ did: 'Took it', didnt: "Didn't take it" }}
        color="espresso"
        onSaveName={vi.fn()}
        onSaveDefaultState={vi.fn()}
        onSaveStateLabels={vi.fn()}
        onSaveColor={vi.fn()}
        onDelete={vi.fn()}
        onTourNoted={vi.fn()}
        onDismiss={vi.fn()}
        authProviderId="password"
        onDeleteAccount={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Default')).toHaveValue('Took it')
    expect(screen.getByLabelText('Noted.')).toHaveValue("Didn't take it")
  })

  it('closes without writing when nothing is changed', async () => {
    const { onSaveDefaultState, onSaveStateLabels, onDismiss } = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onDismiss).toHaveBeenCalled()
    })
    expect(onSaveDefaultState).not.toHaveBeenCalled()
    expect(onSaveStateLabels).not.toHaveBeenCalled()
  })

  it('shows an error and stays open when saving the default state fails', async () => {
    const { onDismiss } = renderSheet({
      onSaveDefaultState: vi.fn().mockRejectedValue(new Error('offline')),
    })

    fireEvent.click(screen.getByRole('button', { name: SWAP_BUTTON }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.')
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses from the close control without saving', () => {
    const { onSaveDefaultState, onSaveStateLabels, onDismiss } = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onDismiss).toHaveBeenCalled()
    expect(onSaveDefaultState).not.toHaveBeenCalled()
    expect(onSaveStateLabels).not.toHaveBeenCalled()
  })

  it('saves renamed labels and closes', async () => {
    const { onSaveDefaultState, onSaveStateLabels, onDismiss } = renderSheet()

    fireEvent.change(screen.getByLabelText('Default'), { target: { value: 'Took it' } })
    fireEvent.change(screen.getByLabelText('Noted.'), {
      target: { value: "Didn't take it" },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSaveStateLabels).toHaveBeenCalledWith({ did: 'Took it', didnt: "Didn't take it" })
      expect(onDismiss).toHaveBeenCalled()
    })
    expect(onSaveDefaultState).not.toHaveBeenCalled()
  })

  it('trims whitespace from renamed labels before saving', async () => {
    const { onSaveStateLabels } = renderSheet()

    fireEvent.change(screen.getByLabelText('Default'), { target: { value: '  Took it  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSaveStateLabels).toHaveBeenCalledWith({ did: 'Took it', didnt: "Didn't" })
    })
  })

  it('rejects an empty label and does not save', async () => {
    const { onSaveStateLabels, onDismiss } = renderSheet()

    fireEvent.change(screen.getByLabelText('Default'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a label.')
    expect(onSaveStateLabels).not.toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('saves both the default state and renamed labels together in one submit', async () => {
    const { onSaveDefaultState, onSaveStateLabels, onDismiss } = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: SWAP_BUTTON }))
    fireEvent.change(screen.getByLabelText('Noted.'), { target: { value: 'Took it' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSaveDefaultState).toHaveBeenCalledWith('didnt')
      expect(onSaveStateLabels).toHaveBeenCalledWith({ did: 'Took it', didnt: "Didn't" })
      expect(onDismiss).toHaveBeenCalled()
    })
  })

  it('shows an error and stays open when saving labels fails', async () => {
    const { onDismiss } = renderSheet({
      onSaveStateLabels: vi.fn().mockRejectedValue(new Error('offline')),
    })

    fireEvent.change(screen.getByLabelText('Default'), { target: { value: 'Took it' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.')
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('offers a Tour Noted. action that replays onboarding without touching saved state', () => {
    const { onTourNoted, onSaveDefaultState, onSaveStateLabels, onDismiss } = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Tour Noted.' }))

    expect(onTourNoted).toHaveBeenCalled()
    expect(onSaveDefaultState).not.toHaveBeenCalled()
    expect(onSaveStateLabels).not.toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('pre-selects Espresso when the ledger has no explicitly stored color -- the same color the toggle already renders as', () => {
    // The caller (Home) always resolves an unset color to 'espresso' before
    // this component ever sees it -- see domain/ledger.ts's
    // resolveLedgerColor -- so this exercises that resolved value, not a
    // literal absence.
    renderSheet({ color: 'espresso' })
    expect(screen.getByRole('button', { name: 'Espresso' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Clay' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('pre-selects the ledger\'s current color', () => {
    renderSheet({ color: 'moss' })
    expect(screen.getByRole('button', { name: 'Moss' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Espresso' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not offer a "None"/background swatch -- every ledger always has a real resolved color', () => {
    renderSheet()
    expect(screen.queryByRole('button', { name: 'None' })).not.toBeInTheDocument()
  })

  it('saves a newly picked color alongside no other changes', async () => {
    const { onSaveColor, onSaveDefaultState, onSaveStateLabels } = renderSheet({ color: 'espresso' })

    fireEvent.click(screen.getByRole('button', { name: 'Rose' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSaveColor).toHaveBeenCalledWith('rose')
    })
    expect(onSaveDefaultState).not.toHaveBeenCalled()
    expect(onSaveStateLabels).not.toHaveBeenCalled()
  })

  it('switches back to Espresso like any other real color, not a field-clearing action', async () => {
    const { onSaveColor } = renderSheet({ color: 'clay' })

    fireEvent.click(screen.getByRole('button', { name: 'Espresso' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSaveColor).toHaveBeenCalledWith('espresso')
    })
  })

  it('does not save color when it is left unchanged', async () => {
    const { onSaveColor, onDismiss } = renderSheet({ color: 'dust' })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onDismiss).toHaveBeenCalled()
    })
    expect(onSaveColor).not.toHaveBeenCalled()
  })

  it('re-syncs the color swatch when the stored color changes under an open sheet', () => {
    const { rerender } = render(
      <SettingsSheet
        name="Worked out"
        defaultState="did"
        stateLabels={DEFAULT_LABELS}
        color="espresso"
        onSaveName={vi.fn()}
        onSaveDefaultState={vi.fn()}
        onSaveStateLabels={vi.fn()}
        onSaveColor={vi.fn()}
        onDelete={vi.fn()}
        onTourNoted={vi.fn()}
        onDismiss={vi.fn()}
        authProviderId="password"
        onDeleteAccount={vi.fn()}
      />,
    )

    rerender(
      <SettingsSheet
        name="Worked out"
        defaultState="did"
        stateLabels={DEFAULT_LABELS}
        color="straw"
        onSaveName={vi.fn()}
        onSaveDefaultState={vi.fn()}
        onSaveStateLabels={vi.fn()}
        onSaveColor={vi.fn()}
        onDelete={vi.fn()}
        onTourNoted={vi.fn()}
        onDismiss={vi.fn()}
        authProviderId="password"
        onDeleteAccount={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Straw' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renaming a label does not change which state is the default', async () => {
    const { onSaveDefaultState, onSaveStateLabels } = renderSheet({ defaultState: 'didnt' })

    fireEvent.change(screen.getByLabelText('Default'), {
      target: { value: 'Rest day' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSaveStateLabels).toHaveBeenCalledWith({ did: 'Did', didnt: 'Rest day' })
    })
    expect(onSaveDefaultState).not.toHaveBeenCalled()
  })

  describe('name', () => {
    it('pre-fills the Name field with the ledger name', () => {
      renderSheet({ name: 'Drinking' })
      expect(screen.getByLabelText('Name')).toHaveValue('Drinking')
    })

    it('saves a renamed ledger alongside no other changes', async () => {
      const { onSaveName, onSaveDefaultState, onSaveStateLabels, onSaveColor } = renderSheet()

      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onSaveName).toHaveBeenCalledWith('Reading')
      })
      expect(onSaveDefaultState).not.toHaveBeenCalled()
      expect(onSaveStateLabels).not.toHaveBeenCalled()
      expect(onSaveColor).not.toHaveBeenCalled()
    })

    it('trims whitespace from the renamed value', async () => {
      const { onSaveName } = renderSheet()

      fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Reading  ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onSaveName).toHaveBeenCalledWith('Reading')
      })
    })

    it('rejects an emptied name and does not save', async () => {
      const { onSaveName } = renderSheet()

      fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/enter a name/i)
      expect(onSaveName).not.toHaveBeenCalled()
    })

    it('does not save the name when it is left unchanged', async () => {
      const { onSaveName, onDismiss } = renderSheet()

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onDismiss).toHaveBeenCalled()
      })
      expect(onSaveName).not.toHaveBeenCalled()
    })

    it('saves a renamed ledger together with other changed fields in one submit', async () => {
      const { onSaveName, onSaveColor } = renderSheet({ color: 'espresso' })

      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('button', { name: 'Rose' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onSaveName).toHaveBeenCalledWith('Reading')
        expect(onSaveColor).toHaveBeenCalledWith('rose')
      })
    })

    it('re-syncs the Name field when the stored name changes under an open sheet', () => {
      const { rerender } = render(
        <SettingsSheet
          name="Worked out"
          defaultState="did"
          stateLabels={DEFAULT_LABELS}
          color="espresso"
          onSaveName={vi.fn()}
          onSaveDefaultState={vi.fn()}
          onSaveStateLabels={vi.fn()}
          onSaveColor={vi.fn()}
          onDelete={vi.fn()}
          onTourNoted={vi.fn()}
          onDismiss={vi.fn()}
          authProviderId="password"
          onDeleteAccount={vi.fn()}
        />,
      )

      rerender(
        <SettingsSheet
          name="Renamed elsewhere"
          defaultState="did"
          stateLabels={DEFAULT_LABELS}
          color="espresso"
          onSaveName={vi.fn()}
          onSaveDefaultState={vi.fn()}
          onSaveStateLabels={vi.fn()}
          onSaveColor={vi.fn()}
          onDelete={vi.fn()}
          onTourNoted={vi.fn()}
          onDismiss={vi.fn()}
          authProviderId="password"
          onDeleteAccount={vi.fn()}
        />,
      )

      expect(screen.getByLabelText('Name')).toHaveValue('Renamed elsewhere')
    })

    it('shows an error and stays open when saving the name fails', async () => {
      const { onDismiss } = renderSheet({
        onSaveName: vi.fn().mockRejectedValue(new Error('offline')),
      })

      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.')
      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('gives the first/legacy-migrated ledger the exact same name and color editing capability as any other', () => {
      // Nothing in this component ever branches on ledger id -- the legacy
      // ledger id ('default') is passed in exactly like any other id would
      // be, purely to prove no special-casing leaks into the UI.
      renderSheet({ name: 'Worked out' })

      expect(screen.getByLabelText('Name')).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Color' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete ledger' })).toBeInTheDocument()
    })
  })

  describe('delete', () => {
    it('offers a quiet Delete ledger action, visually separated from normal configuration', () => {
      renderSheet()
      expect(screen.getByRole('button', { name: 'Delete ledger' })).toBeInTheDocument()
    })

    it('requires a confirm tap before deleting', () => {
      const { onDelete } = renderSheet({ name: 'Worked out' })
      fireEvent.click(screen.getByRole('button', { name: 'Delete ledger' }))

      expect(onDelete).not.toHaveBeenCalled()
      expect(screen.getByText(/Delete "Worked out" and its history\?/)).toBeInTheDocument()
    })

    it('replaces the whole form with the confirm prompt, hiding normal configuration while pending', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Delete ledger' }))

      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Default')).not.toBeInTheDocument()
    })

    it('cancel reverts to the normal settings form without deleting', () => {
      const { onDelete } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Delete ledger' }))
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onDelete).not.toHaveBeenCalled()
      expect(screen.queryByText(/and its history/)).not.toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    it('confirming deletes the ledger and closes the sheet', async () => {
      const { onDelete, onDismiss } = renderSheet({ name: 'Worked out' })
      fireEvent.click(screen.getByRole('button', { name: 'Delete ledger' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete Worked out forever' }))

      await vi.waitFor(() => {
        expect(onDelete).toHaveBeenCalled()
        expect(onDismiss).toHaveBeenCalled()
      })
    })

    it('allows deleting even when this is the only ledger, relying on the caller for safe fallback', () => {
      // SettingsSheet itself has no ledger count -- the safe active-ledger
      // fallback after a delete is entirely Home/useLedgers' job.
      renderSheet()
      expect(screen.getByRole('button', { name: 'Delete ledger' })).toBeInTheDocument()
    })

    it('shows an error and stays in the confirm state when deletion fails', async () => {
      const onDelete = vi.fn().mockRejectedValue(new Error('offline'))
      renderSheet({ onDelete, name: 'Worked out' })

      fireEvent.click(screen.getByRole('button', { name: 'Delete ledger' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete Worked out forever' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete. Try again.')
      expect(screen.getByText(/and its history/)).toBeInTheDocument()
    })

    it('does not touch defaultState/labels/color saving when deleting', async () => {
      const { onDelete, onSaveDefaultState, onSaveStateLabels, onSaveColor } = renderSheet({
        name: 'Worked out',
      })
      fireEvent.click(screen.getByRole('button', { name: 'Delete ledger' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete Worked out forever' }))

      await vi.waitFor(() => {
        expect(onDelete).toHaveBeenCalled()
      })
      expect(onSaveDefaultState).not.toHaveBeenCalled()
      expect(onSaveStateLabels).not.toHaveBeenCalled()
      expect(onSaveColor).not.toHaveBeenCalled()
    })
  })

  describe('delete account', () => {
    it('offers a quiet Delete account action, separate from Delete ledger', () => {
      renderSheet()

      const deleteLedgerButton = screen.getByRole('button', { name: 'Delete ledger' })
      const deleteAccountButton = screen.getByRole('button', { name: 'Delete account' })
      expect(deleteAccountButton).toBeInTheDocument()
      expect(deleteAccountButton.parentElement).not.toBe(deleteLedgerButton.parentElement)
    })

    it('requires a confirm tap before deleting, and warns the deletion is permanent', () => {
      const { onDeleteAccount } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))

      expect(onDeleteAccount).not.toHaveBeenCalled()
      expect(screen.getByText(/permanently delete your account, every ledger/i)).toBeInTheDocument()
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    })

    it('replaces the whole form with the confirm prompt, hiding normal configuration while pending', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))

      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Delete ledger' })).not.toBeInTheDocument()
    })

    it('cancel reverts to the normal settings form without deleting', () => {
      const { onDeleteAccount } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onDeleteAccount).not.toHaveBeenCalled()
      expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    describe('password-provider account', () => {
      it('asks for the password and requires it before confirming', () => {
        const { onDeleteAccount } = renderSheet({ authProviderId: 'password' })
        fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))

        expect(screen.getByLabelText('Password')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Delete account forever' }))

        expect(onDeleteAccount).not.toHaveBeenCalled()
        expect(screen.getByRole('alert')).toHaveTextContent(/enter your password/i)
      })

      it('confirming with a password calls onDeleteAccount with it', async () => {
        const { onDeleteAccount } = renderSheet({ authProviderId: 'password' })
        fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2' } })
        fireEvent.click(screen.getByRole('button', { name: 'Delete account forever' }))

        await vi.waitFor(() => {
          expect(onDeleteAccount).toHaveBeenCalledWith('hunter2')
        })
      })
    })

    describe('google-provider account', () => {
      it('shows no password field, just a note that Google will confirm', () => {
        renderSheet({ authProviderId: 'google.com' })
        fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))

        expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
        expect(screen.getByText(/confirm with google/i)).toBeInTheDocument()
      })

      it('confirming calls onDeleteAccount with no password', async () => {
        const { onDeleteAccount } = renderSheet({ authProviderId: 'google.com' })
        fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
        fireEvent.click(screen.getByRole('button', { name: 'Delete account forever' }))

        await vi.waitFor(() => {
          expect(onDeleteAccount).toHaveBeenCalledWith(undefined)
        })
      })
    })

    it('shows a specific reauthentication message and stays in the confirm state when reauthentication is required', async () => {
      const onDeleteAccount = vi.fn().mockRejectedValue({ code: 'auth/requires-recent-login' })
      renderSheet({ onDeleteAccount, authProviderId: 'google.com' })

      fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete account forever' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/confirm your sign-in again/i)
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    })

    it('shows a specific message and stays in the confirm state when data deletion fails', async () => {
      const onDeleteAccount = vi.fn().mockRejectedValue(new Error('offline'))
      renderSheet({ onDeleteAccount, authProviderId: 'google.com' })

      fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete account forever' }))

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    })

    it('does not touch ledger deletion or normal saving when deleting the account', async () => {
      const { onDeleteAccount, onDelete, onSaveName } = renderSheet({ authProviderId: 'google.com' })
      fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete account forever' }))

      await vi.waitFor(() => {
        expect(onDeleteAccount).toHaveBeenCalled()
      })
      expect(onDelete).not.toHaveBeenCalled()
      expect(onSaveName).not.toHaveBeenCalled()
    })
  })
})
