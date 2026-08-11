import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SettingsSheet } from './SettingsSheet'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  })
})

describe('SettingsSheet', () => {
  it('shows the current default state selected', () => {
    render(
      <SettingsSheet defaultState="did" onSaveDefaultState={vi.fn()} onDismiss={vi.fn()} />,
    )

    expect(screen.getByRole('radio', { name: 'Did' })).toBeChecked()
    expect(screen.getByRole('radio', { name: "Didn't" })).not.toBeChecked()
  })

  it('states plainly which days the change reaches', () => {
    render(
      <SettingsSheet defaultState="did" onSaveDefaultState={vi.fn()} onDismiss={vi.fn()} />,
    )

    expect(
      screen.getByText(
        'Days you have marked keep what they say. Days you have not follow this setting.',
      ),
    ).toBeInTheDocument()
  })

  it('re-syncs the selection when the stored default changes under an open sheet', () => {
    const onSaveDefaultState = vi.fn()
    const { rerender } = render(
      <SettingsSheet
        defaultState="did"
        onSaveDefaultState={onSaveDefaultState}
        onDismiss={vi.fn()}
      />,
    )

    rerender(
      <SettingsSheet
        defaultState="didnt"
        onSaveDefaultState={onSaveDefaultState}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByRole('radio', { name: "Didn't" })).toBeChecked()

    // Saving an untouched form must not push the stale value back.
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSaveDefaultState).not.toHaveBeenCalled()
  })

  it('saves the newly selected default and closes', async () => {
    const onSaveDefaultState = vi.fn().mockResolvedValue(undefined)
    const onDismiss = vi.fn()
    render(
      <SettingsSheet
        defaultState="did"
        onSaveDefaultState={onSaveDefaultState}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onSaveDefaultState).toHaveBeenCalledWith('didnt')
      expect(onDismiss).toHaveBeenCalled()
    })
  })

  it('closes without writing when the selection is unchanged', async () => {
    const onSaveDefaultState = vi.fn()
    const onDismiss = vi.fn()
    render(
      <SettingsSheet
        defaultState="did"
        onSaveDefaultState={onSaveDefaultState}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(onDismiss).toHaveBeenCalled()
    })
    expect(onSaveDefaultState).not.toHaveBeenCalled()
  })

  it('shows an error and stays open when the save fails', async () => {
    const onSaveDefaultState = vi.fn().mockRejectedValue(new Error('offline'))
    const onDismiss = vi.fn()
    render(
      <SettingsSheet
        defaultState="did"
        onSaveDefaultState={onSaveDefaultState}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.')
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses from the close control without saving', () => {
    const onSaveDefaultState = vi.fn()
    const onDismiss = vi.fn()
    render(
      <SettingsSheet
        defaultState="did"
        onSaveDefaultState={onSaveDefaultState}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onDismiss).toHaveBeenCalled()
    expect(onSaveDefaultState).not.toHaveBeenCalled()
  })
})
