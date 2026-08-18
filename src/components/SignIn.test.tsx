import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const { signInWithGoogleMock, signInWithEmailMock, signUpWithEmailMock } = vi.hoisted(() => ({
  signInWithGoogleMock: vi.fn(),
  signInWithEmailMock: vi.fn(),
  signUpWithEmailMock: vi.fn(),
}))

vi.mock('../lib/auth', () => ({
  signInWithGoogle: signInWithGoogleMock,
  signInWithEmail: signInWithEmailMock,
  signUpWithEmail: signUpWithEmailMock,
}))

const { SignIn } = await import('./SignIn')

beforeEach(() => {
  signInWithGoogleMock.mockReset()
  signInWithEmailMock.mockReset()
  signUpWithEmailMock.mockReset()
})

describe('SignIn', () => {
  it('offers both Google and email as entry points', () => {
    render(<SignIn />)

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with email' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('signs in with Google on click', async () => {
    signInWithGoogleMock.mockResolvedValue(undefined)
    render(<SignIn />)

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    await vi.waitFor(() => {
      expect(signInWithGoogleMock).toHaveBeenCalledTimes(1)
    })
  })

  it('shows a neutral message and recovers the button if the Google redirect fails to even start', async () => {
    signInWithGoogleMock.mockRejectedValue({ code: 'auth/network-request-failed' })
    render(<SignIn />)

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/network error/i)
    expect(screen.getByRole('button', { name: 'Continue with Google' })).not.toBeDisabled()
  })

  it('shows a Google redirect error passed in from boot immediately, without requiring another click', () => {
    render(<SignIn authError="Sign-in did not complete. Try again." />)

    expect(screen.getByRole('alert')).toHaveTextContent(/sign-in did not complete/i)
  })

  it('reveals the email form on "Continue with email", defaulting to sign-in', () => {
    render(<SignIn />)

    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }))

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue with email' })).not.toBeInTheDocument()
  })

  it('requires both fields before attempting an email sign-in', () => {
    render(<SignIn />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }))

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/enter your email and password/i)
    expect(signInWithEmailMock).not.toHaveBeenCalled()
  })

  it('signs in with an existing email/password account', async () => {
    signInWithEmailMock.mockResolvedValue(undefined)
    render(<SignIn />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }))

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await vi.waitFor(() => {
      expect(signInWithEmailMock).toHaveBeenCalledWith('person@example.com', 'hunter2')
    })
    expect(signUpWithEmailMock).not.toHaveBeenCalled()
  })

  it('switches to create-account mode and signs up instead', async () => {
    signUpWithEmailMock.mockResolvedValue(undefined)
    render(<SignIn />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }))

    fireEvent.click(screen.getByRole('button', { name: /new here\? create an account/i }))
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await vi.waitFor(() => {
      expect(signUpWithEmailMock).toHaveBeenCalledWith('new@example.com', 'hunter2')
    })
    expect(signInWithEmailMock).not.toHaveBeenCalled()
  })

  it('toggles back from create-account to sign-in mode', () => {
    render(<SignIn />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }))
    fireEvent.click(screen.getByRole('button', { name: /new here\? create an account/i }))

    fireEvent.click(screen.getByRole('button', { name: /already have an account\? sign in/i }))

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('hints at Google for an email already registered with a different provider', async () => {
    signUpWithEmailMock.mockRejectedValue({ code: 'auth/email-already-in-use' })
    render(<SignIn />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }))
    fireEvent.click(screen.getByRole('button', { name: /new here\? create an account/i }))

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'existing@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists.*sign in instead/i)
  })

  it('hints at Google for a wrong-password attempt that may actually be a Google-only account', async () => {
    signInWithEmailMock.mockRejectedValue({ code: 'auth/invalid-credential' })
    render(<SignIn />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }))

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/continue with google instead/i)
  })
})
