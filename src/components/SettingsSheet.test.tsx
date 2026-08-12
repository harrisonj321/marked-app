import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SettingsSheet } from './SettingsSheet'

const DEFAULT_LABELS = { did: 'Did', didnt: "Didn't" }

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
  const onDismiss = vi.fn()
  render(
    <SettingsSheet
      defaultState="did"
      stateLabels={DEFAULT_LABELS}
      onSaveDefaultState={onSaveDefaultState}
      onSaveStateLabels={onSaveStateLabels}
      onDismiss={onDismiss}
      {...overrides}
    />,
  )
  return { onSaveDefaultState, onSaveStateLabels, onDismiss }
}

describe('SettingsSheet', () => {
  it('shows the current default state selected, using the configured labels', () => {
    renderSheet()

    expect(screen.getByRole('radio', { name: 'Did' })).toBeChecked()
    expect(screen.getByRole('radio', { name: "Didn't" })).not.toBeChecked()
  })

  it('states plainly which days the change reaches', () => {
    renderSheet()

    expect(
      screen.getByText(
        'Days you have marked keep what they say. Days you have not follow this setting.',
      ),
    ).toBeInTheDocument()
  })

  it('renders the default-state options using custom labels instead of Did/Didn\'t', () => {
    renderSheet({ stateLabels: { did: 'Took it', didnt: "Didn't take it" } })

    expect(screen.getByRole('radio', { name: 'Took it' })).toBeChecked()
    expect(screen.getByRole('radio', { name: "Didn't take it" })).not.toBeChecked()
  })

  it('pre-fills the label fields with the current labels', () => {
    renderSheet({ stateLabels: { did: 'Took it', didnt: "Didn't take it" } })

    expect(screen.getByLabelText('First option')).toHaveValue('Took it')
    expect(screen.getByLabelText('Second option')).toHaveValue("Didn't take it")
  })

  it('re-syncs the selection when the stored default changes under an open sheet', () => {
    const { onSaveDefaultState, onSaveStateLabels, onDismiss } = (() => {
      const onSaveDefaultState = vi.fn()
      const onSaveStateLabels = vi.fn()
      const onDismiss = vi.fn()
      return { onSaveDefaultState, onSaveStateLabels, onDismiss }
    })()

    const { rerender } = render(
      <SettingsSheet
        defaultState="did"
        stateLabels={DEFAULT_LABELS}
        onSaveDefaultState={onSaveDefaultState}
        onSaveStateLabels={onSaveStateLabels}
        onDismiss={onDismiss}
      />,
    )

    rerender(
      <SettingsSheet
        defaultState="didnt"
        stateLabels={DEFAULT_LABELS}
        onSaveDefaultState={onSaveDefaultState}
        onSaveStateLabels={onSaveStateLabels}
        onDismiss={onDismiss}
      />,
    )

    expect(screen.getByRole('radio', { name: "Didn't" })).toBeChecked()

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
        onDismiss={vi.fn()}
      />,
    )

    rerender(
      <SettingsSheet
        defaultState="did"
        stateLabels={{ did: 'Took it', didnt: "Didn't take it" }}
        onSaveDefaultState={vi.fn()}
        onSaveStateLabels={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('First option')).toHaveValue('Took it')
    expect(screen.getByLabelText('Second option')).toHaveValue("Didn't take it")
  })

  it('saves the newly selected default and closes', async () => {
    const { onSaveDefaultState, onSaveStateLabels, onDismiss } = renderSheet()

    fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSaveDefaultState).toHaveBeenCalledWith('didnt')
      expect(onDismiss).toHaveBeenCalled()
    })
    expect(onSaveStateLabels).not.toHaveBeenCalled()
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

    fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))
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

    fireEvent.change(screen.getByLabelText('First option'), { target: { value: 'Took it' } })
    fireEvent.change(screen.getByLabelText('Second option'), {
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

    fireEvent.change(screen.getByLabelText('First option'), { target: { value: '  Took it  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSaveStateLabels).toHaveBeenCalledWith({ did: 'Took it', didnt: "Didn't" })
    })
  })

  it('rejects an empty label and does not save', async () => {
    const { onSaveStateLabels, onDismiss } = renderSheet()

    fireEvent.change(screen.getByLabelText('First option'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a label.')
    expect(onSaveStateLabels).not.toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('saves both the default state and renamed labels together in one submit', async () => {
    const { onSaveDefaultState, onSaveStateLabels, onDismiss } = renderSheet()

    fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))
    fireEvent.change(screen.getByLabelText('First option'), { target: { value: 'Took it' } })
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

    fireEvent.change(screen.getByLabelText('First option'), { target: { value: 'Took it' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.')
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('renaming a label does not change which state is the default', async () => {
    const { onSaveDefaultState, onSaveStateLabels } = renderSheet({ defaultState: 'didnt' })

    fireEvent.change(screen.getByLabelText('Second option'), {
      target: { value: 'Rest day' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSaveStateLabels).toHaveBeenCalledWith({ did: 'Did', didnt: 'Rest day' })
    })
    expect(onSaveDefaultState).not.toHaveBeenCalled()
  })
})
