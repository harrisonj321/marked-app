import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SettingsSheet } from './SettingsSheet'

const DEFAULT_LABELS = { did: 'Did', didnt: "Didn't" }

const FIRST_DEFAULT_RADIO = 'First option is the untouched-day default'
const SECOND_DEFAULT_RADIO = 'Second option is the untouched-day default'

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
  it('marks the current default option', () => {
    renderSheet()

    expect(screen.getByRole('radio', { name: FIRST_DEFAULT_RADIO })).toBeChecked()
    expect(screen.getByRole('radio', { name: SECOND_DEFAULT_RADIO })).not.toBeChecked()
  })

  it('marks the second option when it is the default', () => {
    renderSheet({ defaultState: 'didnt' })

    expect(screen.getByRole('radio', { name: SECOND_DEFAULT_RADIO })).toBeChecked()
    expect(screen.getByRole('radio', { name: FIRST_DEFAULT_RADIO })).not.toBeChecked()
  })

  it('explains what the selected option means and where it lands on the toggle', () => {
    renderSheet()

    expect(screen.getByText(/what an untouched day means/i)).toBeInTheDocument()
    expect(screen.getByText(/left of today's toggle/i)).toBeInTheDocument()
    expect(screen.getByText(/already marked keep what they say/i)).toBeInTheDocument()
  })

  it('presents one combined control per state rather than separate default and label sections', () => {
    renderSheet()

    // Exactly one fieldset carries both the default choice and its label,
    // not two disconnected fieldsets for the same two concepts.
    expect(screen.getAllByRole('group')).toHaveLength(1)
    expect(screen.getByRole('group', { name: 'The two states' })).toBeInTheDocument()
  })

  it('pre-fills the label fields with the current labels', () => {
    renderSheet({ stateLabels: { did: 'Took it', didnt: "Didn't take it" } })

    expect(screen.getByLabelText('First option')).toHaveValue('Took it')
    expect(screen.getByLabelText('Second option')).toHaveValue("Didn't take it")
  })

  it('selecting a different default does not change either label value', () => {
    renderSheet()

    fireEvent.click(screen.getByRole('radio', { name: SECOND_DEFAULT_RADIO }))

    expect(screen.getByLabelText('First option')).toHaveValue('Did')
    expect(screen.getByLabelText('Second option')).toHaveValue("Didn't")
  })

  it('re-syncs the selection when the stored default changes under an open sheet', () => {
    const onSaveDefaultState = vi.fn()
    const onSaveStateLabels = vi.fn()
    const onDismiss = vi.fn()

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

    expect(screen.getByRole('radio', { name: SECOND_DEFAULT_RADIO })).toBeChecked()

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

    fireEvent.click(screen.getByRole('radio', { name: SECOND_DEFAULT_RADIO }))
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

    fireEvent.click(screen.getByRole('radio', { name: SECOND_DEFAULT_RADIO }))
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

    fireEvent.click(screen.getByRole('radio', { name: SECOND_DEFAULT_RADIO }))
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
