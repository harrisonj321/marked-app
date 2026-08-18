import { describe, expect, it, vi } from 'vitest'

const {
  createUserWithEmailAndPasswordMock,
  getRedirectResultMock,
  onAuthStateChangedMock,
  signInWithEmailAndPasswordMock,
  signInWithRedirectMock,
  signOutMock,
} = vi.hoisted(() => ({
  createUserWithEmailAndPasswordMock: vi.fn(),
  getRedirectResultMock: vi.fn(),
  onAuthStateChangedMock: vi.fn(),
  signInWithEmailAndPasswordMock: vi.fn(),
  signInWithRedirectMock: vi.fn(),
  signOutMock: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class GoogleAuthProvider {},
  createUserWithEmailAndPassword: createUserWithEmailAndPasswordMock,
  getRedirectResult: getRedirectResultMock,
  onAuthStateChanged: onAuthStateChangedMock,
  signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
  signInWithRedirect: signInWithRedirectMock,
  signOut: signOutMock,
}))

// The real module requires live Firebase project environment variables at
// import time (see assertFirebaseConfig) -- stubbed here so this test can
// run anywhere without a .env file, same convention as every component test
// that mocks './lib/auth' wholesale instead of importing it for real.
vi.mock('./firebase', () => ({ auth: { __stubAuthInstance: true } }))

const {
  signInWithGoogle,
  resolveGoogleRedirect,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  subscribeAuthUser,
} = await import('./auth')

describe('lib/auth', () => {
  it('signs in with Google via redirect, not popup', async () => {
    signInWithRedirectMock.mockResolvedValue(undefined)

    await signInWithGoogle()

    expect(signInWithRedirectMock).toHaveBeenCalledTimes(1)
    const [authArg, providerArg] = signInWithRedirectMock.mock.calls[0]
    expect(authArg).toEqual({ __stubAuthInstance: true })
    expect(providerArg).toBeInstanceOf(Object)
  })

  it('resolves a pending Google redirect result', async () => {
    getRedirectResultMock.mockResolvedValue(null)

    await resolveGoogleRedirect()

    expect(getRedirectResultMock).toHaveBeenCalledWith({ __stubAuthInstance: true })
  })

  it('propagates a redirect-result error to the caller rather than swallowing it', async () => {
    const error = new Error('boom')
    getRedirectResultMock.mockRejectedValue(error)

    await expect(resolveGoogleRedirect()).rejects.toThrow('boom')
  })

  it('signs in with email and password', async () => {
    signInWithEmailAndPasswordMock.mockResolvedValue(undefined)

    await signInWithEmail('person@example.com', 'hunter2')

    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(
      { __stubAuthInstance: true },
      'person@example.com',
      'hunter2',
    )
  })

  it('creates an account with email and password', async () => {
    createUserWithEmailAndPasswordMock.mockResolvedValue(undefined)

    await signUpWithEmail('person@example.com', 'hunter2')

    expect(createUserWithEmailAndPasswordMock).toHaveBeenCalledWith(
      { __stubAuthInstance: true },
      'person@example.com',
      'hunter2',
    )
  })

  it('signs out', async () => {
    signOutMock.mockResolvedValue(undefined)

    await signOutUser()

    expect(signOutMock).toHaveBeenCalledWith({ __stubAuthInstance: true })
  })

  it('subscribes to auth state changes', () => {
    const unsubscribe = vi.fn()
    onAuthStateChangedMock.mockReturnValue(unsubscribe)
    const onChange = vi.fn()

    const result = subscribeAuthUser(onChange)

    expect(onAuthStateChangedMock).toHaveBeenCalledWith({ __stubAuthInstance: true }, onChange)
    expect(result).toBe(unsubscribe)
  })
})
