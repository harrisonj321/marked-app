import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Wordmark } from './Wordmark'

describe('Wordmark', () => {
  it('renders the light-mode artwork as the default img', () => {
    render(<Wordmark className="brand" />)
    const img = screen.getByRole('img', { name: 'Marked.' })
    expect(img).toHaveAttribute('src', '/wordmark.png')
    expect(img).toHaveClass('brand')
  })

  it('offers the dark-mode artwork as a prefers-color-scheme picture source', () => {
    const { container } = render(<Wordmark />)
    const source = container.querySelector('picture > source')
    expect(source).toHaveAttribute('srcset', '/wordmark-dark.png')
    expect(source).toHaveAttribute('media', '(prefers-color-scheme: dark)')
  })
})
