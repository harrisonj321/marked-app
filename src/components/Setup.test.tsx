import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Setup } from './Setup'

describe('Setup', () => {
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
