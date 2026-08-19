import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Setup } from './Setup'

describe('Setup', () => {
  it('opens directly on the real ledger-creation form, name field focused', () => {
    render(<Setup onComplete={vi.fn()} />)

    const nameInput = screen.getByLabelText(/what are you tracking/i)
    expect(nameInput).toBeInTheDocument()
    expect(nameInput).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'I did it' })).toBeInTheDocument()
  })

  it('lets the user type a freeform name with no suggestions expanded', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    render(<Setup onComplete={onComplete} />)

    fireEvent.change(screen.getByLabelText(/what are you tracking/i), {
      target: { value: 'Reading' },
    })
    fireEvent.click(screen.getByRole('radio', { name: 'I did it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onComplete).toHaveBeenCalledWith({ name: 'Reading', defaultState: 'did' })
  })

  describe('suggestions disclosure', () => {
    const TOGGLE_NAME = 'Not sure what to note? Try one of these.'

    it('starts collapsed, with no "Something else" choice', () => {
      render(<Setup onComplete={vi.fn()} />)

      expect(screen.queryByRole('button', { name: 'Worked out' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Something else' })).not.toBeInTheDocument()
      const toggle = screen.getByRole('button', { name: TOGGLE_NAME })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })

    it('expands to show all six suggestions', () => {
      render(<Setup onComplete={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: TOGGLE_NAME }))

      expect(screen.getByRole('button', { name: TOGGLE_NAME })).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('button', { name: 'Worked out' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ate out' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Headache' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drank alcohol' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cooked dinner' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Good day' })).toBeInTheDocument()
    })

    it('collapses again on a second toggle click', () => {
      render(<Setup onComplete={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: TOGGLE_NAME }))
      fireEvent.click(screen.getByRole('button', { name: TOGGLE_NAME }))

      expect(screen.queryByRole('button', { name: 'Worked out' })).not.toBeInTheDocument()
    })

    it('selecting a suggestion only populates the name field and collapses the disclosure', () => {
      render(<Setup onComplete={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: TOGGLE_NAME }))
      fireEvent.click(screen.getByRole('button', { name: 'Headache' }))

      expect(screen.getByLabelText(/what are you tracking/i)).toHaveValue('Headache')
      expect(screen.queryByRole('button', { name: 'Worked out' })).not.toBeInTheDocument()
    })

    it('a selected suggestion remains a plain editable name, not a locked-in choice', async () => {
      const onComplete = vi.fn().mockResolvedValue(undefined)
      render(<Setup onComplete={onComplete} />)

      fireEvent.click(screen.getByRole('button', { name: TOGGLE_NAME }))
      fireEvent.click(screen.getByRole('button', { name: 'Good day' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), {
        target: { value: 'Meditated' },
      })
      fireEvent.click(screen.getByRole('radio', { name: "I didn't do it" }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(onComplete).toHaveBeenCalledWith({ name: 'Meditated', defaultState: 'didnt' })
    })

    it('does not attach a category or predefined state to a selected suggestion', async () => {
      const onComplete = vi.fn().mockResolvedValue(undefined)
      render(<Setup onComplete={onComplete} />)

      fireEvent.click(screen.getByRole('button', { name: TOGGLE_NAME }))
      fireEvent.click(screen.getByRole('button', { name: 'Drank alcohol' }))
      fireEvent.click(screen.getByRole('radio', { name: 'I did it' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(onComplete).toHaveBeenCalledWith({ name: 'Drank alcohol', defaultState: 'did' })
      expect(onComplete.mock.calls[0][0]).not.toHaveProperty('category')
      expect(onComplete.mock.calls[0][0]).not.toHaveProperty('stateLabels')
    })
  })

  it('keeps the state-label flexibility note as subordinate helper text', () => {
    render(<Setup onComplete={vi.fn()} />)

    const hint = screen.getByText(/you can rename these, or pick other words entirely, anytime/i)
    expect(hint).toHaveClass('field-hint')
    expect(hint).not.toHaveClass('message')
  })

  it('rejects an empty name', async () => {
    const onComplete = vi.fn()
    render(<Setup onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('radio', { name: 'I did it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/enter a name/i)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only name', async () => {
    const onComplete = vi.fn()
    render(<Setup onComplete={onComplete} />)

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
    render(<Setup onComplete={onComplete} />)

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
    render(<Setup onComplete={onComplete} />)

    fireEvent.change(screen.getByLabelText(/what are you tracking/i), {
      target: { value: '  Worked out  ' },
    })
    fireEvent.click(screen.getByRole('radio', { name: "I didn't do it" }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onComplete).toHaveBeenCalledWith({ name: 'Worked out', defaultState: 'didnt' })
  })
})
