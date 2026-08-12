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
  const onSaveDefaultState = vi.fn().mockResolvedValue(undefined)
  const onSaveStateLabels = vi.fn().mockResolvedValue(undefined)
  const onTourNoted = vi.fn()
  const onDismiss = vi.fn()
  render(
    <SettingsSheet
      defaultState="did"
      stateLabels={DEFAULT_LABELS}
      onSaveDefaultState={onSaveDefaultState}
      onSaveStateLabels={onSaveStateLabels}
      onTourNoted={onTourNoted}
      onDismiss={onDismiss}
      {...overrides}
    />,
  )
  return { onSaveDefaultState, onSaveStateLabels, onTourNoted, onDismiss }
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
        defaultState="did"
        stateLabels={DEFAULT_LABELS}
        onSaveDefaultState={onSaveDefaultState}
        onSaveStateLabels={onSaveStateLabels}
        onTourNoted={vi.fn()}
        onDismiss={onDismiss}
      />,
    )

    rerender(
      <SettingsSheet
        defaultState="didnt"
        stateLabels={DEFAULT_LABELS}
        onSaveDefaultState={onSaveDefaultState}
        onSaveStateLabels={onSaveStateLabels}
        onTourNoted={vi.fn()}
        onDismiss={onDismiss}
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
        defaultState="did"
        stateLabels={DEFAULT_LABELS}
        onSaveDefaultState={vi.fn()}
        onSaveStateLabels={vi.fn()}
        onTourNoted={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )

    rerender(
      <SettingsSheet
        defaultState="did"
        stateLabels={{ did: 'Took it', didnt: "Didn't take it" }}
        onSaveDefaultState={vi.fn()}
        onSaveStateLabels={vi.fn()}
        onTourNoted={vi.fn()}
        onDismiss={vi.fn()}
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
})
