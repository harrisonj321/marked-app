import { useState } from 'react'
import { signInWithGoogle } from '../lib/auth'

export function SignIn() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setPending(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      if (!isCancelledPopup(err)) {
        setError('Sign-in did not complete. Try again.')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="screen screen-center">
      <h1>Noted.</h1>
      <button type="button" onClick={() => void handleClick()} disabled={pending}>
        Continue with Google
      </button>
      {error && (
        <p role="alert" className="message">
          {error}
        </p>
      )}
    </main>
  )
}

function isCancelledPopup(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request')
  )
}
