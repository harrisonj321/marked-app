import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TrackerNameEditor } from './TrackerNameEditor'

describe('TrackerNameEditor', () => {
  it('starts in display mode showing the current name', () => {
    render(<TrackerNameEditor name="Worked out" onSave={vi.fn()} />)

    expect(screen.getByText('Worked out')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('rejects an empty name on save', async () => {
    render(<TrackerNameEditor name="Worked out" onSave={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /edit tracker name/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/enter a name/i)
  })

  it('saves a trimmed valid name', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<TrackerNameEditor name="Worked out" onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: /edit tracker name/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Reading  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith('Reading')
  })

  it('cancel discards changes without saving', () => {
    const onSave = vi.fn()
    render(<TrackerNameEditor name="Worked out" onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: /edit tracker name/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Something else' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Worked out')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})
