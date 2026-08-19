import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { Setup } from './Setup'

/** Every non-suggestion test starts here: skip past suggestions to the blank form. */
function renderAtForm(onComplete: (input: { name: string; defaultState: 'did' | 'didnt' }) => Promise<void>) {
  render(<Setup onComplete={onComplete} />)
  fireEvent.click(screen.getByRole('button', { name: 'Something else' }))
}

describe('Setup', () => {
  it('opens on suggested ledger examples', () => {
    render(<Setup onComplete={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Worked out' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ate out' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Headache' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drank alcohol' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cooked dinner' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Good day' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Something else' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/what are you tracking/i)).not.toBeInTheDocument()
  })

  it('selecting a suggestion seeds the name and continues to the normal form', () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    render(<Setup onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: 'Headache' }))

    const nameInput = screen.getByLabelText(/what are you tracking/i)
    expect(nameInput).toHaveValue('Headache')

    fireEvent.click(screen.getByRole('radio', { name: 'I did it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onComplete).toHaveBeenCalledWith({ name: 'Headache', defaultState: 'did' })
  })

  it('a suggested name remains editable before saving', () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    render(<Setup onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: 'Good day' }))
    fireEvent.change(screen.getByLabelText(/what are you tracking/i), {
      target: { value: 'Meditated' },
    })
    fireEvent.click(screen.getByRole('radio', { name: "I didn't do it" }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onComplete).toHaveBeenCalledWith({ name: 'Meditated', defaultState: 'didnt' })
  })

  it('"Something else" opens the normal form with a blank name', () => {
    render(<Setup onComplete={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Something else' }))

    expect(screen.getByLabelText(/what are you tracking/i)).toHaveValue('')
  })

  it('rejects an empty name', async () => {
    const onComplete = vi.fn()
    renderAtForm(onComplete)

    fireEvent.click(screen.getByRole('radio', { name: 'I did it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/enter a name/i)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only name', async () => {
    const onComplete = vi.fn()
    renderAtForm(onComplete)

    fireEvent.change(screen.getByLabelText(/what are you tracking/i), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('radio', { name: 'I did it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/enter a name/i)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('requires a default-state selection before saving', async () => {
    const onComplete = vi.fn()
    renderAtForm(onComplete)

    fireEvent.change(screen.getByLabelText(/what are you tracking/i), {
      target: { value: 'Worked out' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /choose what an untouched day means/i,
    )
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('submits the trimmed name and selected default state', () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    renderAtForm(onComplete)

    fireEvent.change(screen.getByLabelText(/what are you tracking/i), {
      target: { value: '  Worked out  ' },
    })
    fireEvent.click(screen.getByRole('radio', { name: "I didn't do it" }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onComplete).toHaveBeenCalledWith({ name: 'Worked out', defaultState: 'didnt' })
  })
})
