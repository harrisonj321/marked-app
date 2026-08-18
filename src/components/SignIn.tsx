import { useId, useState, type FormEvent } from 'react'
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from '../lib/auth'
import { describeAuthError } from '../lib/authErrors'

type EmailMode = 'signin' | 'signup'

interface SignInProps {
  /** A Google redirect that just completed and failed, surfaced from boot -- see useAuthUser. */
  authError?: string | null
}

export function SignIn({ authError = null }: SignInProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(authError)
  const [emailFormOpen, setEmailFormOpen] = useState(false)
  const [emailMode, setEmailMode] = useState<EmailMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const emailId = useId()
  const passwordId = useId()

  async function handleGoogleClick() {
    setError(null)
    setPending(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(describeAuthError(err))
      setPending(false)
    }
  }

  function openEmailForm() {
    setError(null)
    setEmailFormOpen(true)
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }

    setPending(true)
    try {
      if (emailMode === 'signup') {
        await signUpWithEmail(email.trim(), password)
      } else {
        await signInWithEmail(email.trim(), password)
      }
    } catch (err) {
      setError(describeAuthError(err))
    } finally {
      setPending(false)
    }
  }

  function toggleEmailMode() {
    setError(null)
    setEmailMode((mode) => (mode === 'signup' ? 'signin' : 'signup'))
  }

  return (
    <main className="screen screen-center">
      <h1>Noted.</h1>

      <div className="signin-actions">
        <button type="button" onClick={() => void handleGoogleClick()} disabled={pending}>
          Continue with Google
        </button>

        {!emailFormOpen && (
          <button
            type="button"
            className="signin-secondary"
            onClick={openEmailForm}
            disabled={pending}
          >
            Continue with email
          </button>
        )}
      </div>

      {emailFormOpen && (
        <form className="signin-email-form" onSubmit={(event) => void handleEmailSubmit(event)} noValidate>
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor={passwordId}>Password</label>
          <input
            id={passwordId}
            type="password"
            autoComplete={emailMode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <button type="submit" disabled={pending}>
            {emailMode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
          <button type="button" className="signin-secondary" onClick={toggleEmailMode} disabled={pending}>
            {emailMode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="message">
          {error}
        </p>
      )}
    </main>
  )
}
