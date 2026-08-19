import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createUserWithEmailAndPasswordMock,
  deleteUserMock,
  getRedirectResultMock,
  onAuthStateChangedMock,
  reauthenticateWithCredentialMock,
  reauthenticateWithPopupMock,
  signInWithEmailAndPasswordMock,
  signInWithRedirectMock,
  signOutMock,
} = vi.hoisted(() => ({
  createUserWithEmailAndPasswordMock: vi.fn(),
  deleteUserMock: vi.fn(),
  getRedirectResultMock: vi.fn(),
  onAuthStateChangedMock: vi.fn(),
  reauthenticateWithCredentialMock: vi.fn(),
  reauthenticateWithPopupMock: vi.fn(),
  signInWithEmailAndPasswordMock: vi.fn(),
  signInWithRedirectMock: vi.fn(),
  signOutMock: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class GoogleAuthProvider {},
  EmailAuthProvider: {
    credential: (email: string, password: string) => ({ __credential: true, email, password }),
  },
  createUserWithEmailAndPassword: createUserWithEmailAndPasswordMock,
  deleteUser: deleteUserMock,
  getRedirectResult: getRedirectResultMock,
  onAuthStateChanged: onAuthStateChangedMock,
  reauthenticateWithCredential: reauthenticateWithCredentialMock,
  reauthenticateWithPopup: reauthenticateWithPopupMock,
  signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
  signInWithRedirect: signInWithRedirectMock,
  signOut: signOutMock,
}))

// The real module requires live Firebase project environment variables at
// import time (see assertFirebaseConfig) -- stubbed here so this test can
// run anywhere without a .env file, same convention as every component test
// that mocks './lib/auth' wholesale instead of importing it for real.
// currentUser is mutable so reauth/delete tests can set it per case.
const authStub: { __stubAuthInstance: true; currentUser: unknown } = {
  __stubAuthInstance: true,
  currentUser: null,
}
vi.mock('./firebase', () => ({ auth: authStub }))

const {
  signInWithGoogle,
  resolveGoogleRedirect,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  subscribeAuthUser,
  consumeGoogleRedirectPending,
  primaryProviderId,
  reauthenticateWithGoogle,
  reauthenticateWithPassword,
  deleteAuthAccount,
} = await import('./auth')

describe('lib/auth', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    authStub.currentUser = null
    vi.clearAllMocks()
  })

  it('signs in with Google via redirect, not popup', async () => {
    signInWithRedirectMock.mockResolvedValue(undefined)

    await signInWithGoogle()

    expect(signInWithRedirectMock).toHaveBeenCalledTimes(1)
    const [authArg, providerArg] = signInWithRedirectMock.mock.calls[0]
    expect(authArg).toEqual(authStub)
    expect(providerArg).toBeInstanceOf(Object)
  })

  describe('the Google redirect marker', () => {
    // signInWithRedirect performs a full top-level navigation away and
    // back, so there is no in-memory way for the next page load to tell
    // "this boot is that redirect returning" apart from a genuinely fresh
    // open/reload -- see App's use of consumeGoogleRedirectPending under
    // VITE_FORCE_ONBOARDING. sessionStorage is what survives that
    // navigation; signInWithRedirect resolving is what this test can
    // observe in its place, since the real navigation itself can't happen
    // under jsdom.
    it('marks a redirect pending before attempting the navigation, so a later boot can tell it apart from a fresh open', async () => {
      signInWithRedirectMock.mockResolvedValue(undefined)

      await signInWithGoogle()

      expect(consumeGoogleRedirectPending()).toBe(true)
    })

    it('consuming the marker clears it, so it only ever applies to the one boot right after the redirect', async () => {
      signInWithRedirectMock.mockResolvedValue(undefined)
      await signInWithGoogle()

      expect(consumeGoogleRedirectPending()).toBe(true)
      expect(consumeGoogleRedirectPending()).toBe(false)
    })

    it('reports no pending redirect when none was ever started', () => {
      expect(consumeGoogleRedirectPending()).toBe(false)
    })

    it('clears the marker if the redirect attempt itself fails before navigating away, so a later fresh load is not mistaken for a redirect return', async () => {
      signInWithRedirectMock.mockRejectedValue({ code: 'auth/network-request-failed' })

      await expect(signInWithGoogle()).rejects.toBeTruthy()

      expect(consumeGoogleRedirectPending()).toBe(false)
    })
  })

  it('resolves a pending Google redirect result', async () => {
    getRedirectResultMock.mockResolvedValue(null)

    await resolveGoogleRedirect()

    expect(getRedirectResultMock).toHaveBeenCalledWith(authStub)
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
      authStub,
      'person@example.com',
      'hunter2',
    )
  })

  it('creates an account with email and password', async () => {
    createUserWithEmailAndPasswordMock.mockResolvedValue(undefined)

    await signUpWithEmail('person@example.com', 'hunter2')

    expect(createUserWithEmailAndPasswordMock).toHaveBeenCalledWith(
      authStub,
      'person@example.com',
      'hunter2',
    )
  })

  it('signs out', async () => {
    signOutMock.mockResolvedValue(undefined)

    await signOutUser()

    expect(signOutMock).toHaveBeenCalledWith(authStub)
  })

  it('subscribes to auth state changes', () => {
    const unsubscribe = vi.fn()
    onAuthStateChangedMock.mockReturnValue(unsubscribe)
    const onChange = vi.fn()

    const result = subscribeAuthUser(onChange)

    expect(onAuthStateChangedMock).toHaveBeenCalledWith(authStub, onChange)
    expect(result).toBe(unsubscribe)
  })

  describe('primaryProviderId', () => {
    it('reads the first provider entry', () => {
      const user = { providerData: [{ providerId: 'google.com' }] }
      expect(primaryProviderId(user as never)).toBe('google.com')
    })

    it('falls back to password when providerData is empty', () => {
      const user = { providerData: [] }
      expect(primaryProviderId(user as never)).toBe('password')
    })
  })

  describe('reauthenticateWithGoogle', () => {
    it('reauthenticates via popup, not redirect', async () => {
      authStub.currentUser = { uid: 'u1' }
      reauthenticateWithPopupMock.mockResolvedValue(undefined)

      await reauthenticateWithGoogle()

      expect(reauthenticateWithPopupMock).toHaveBeenCalledTimes(1)
      const [userArg, providerArg] = reauthenticateWithPopupMock.mock.calls[0]
      expect(userArg).toBe(authStub.currentUser)
      expect(providerArg).toBeInstanceOf(Object)
      expect(signInWithRedirectMock).not.toHaveBeenCalled()
    })

    it('throws without attempting anything when signed out', async () => {
      authStub.currentUser = null

      await expect(reauthenticateWithGoogle()).rejects.toThrow()
      expect(reauthenticateWithPopupMock).not.toHaveBeenCalled()
    })
  })

  describe('reauthenticateWithPassword', () => {
    it('builds a credential from the current user\'s email and the given password', async () => {
      authStub.currentUser = { uid: 'u1', email: 'person@example.com' }
      reauthenticateWithCredentialMock.mockResolvedValue(undefined)

      await reauthenticateWithPassword('hunter2')

      expect(reauthenticateWithCredentialMock).toHaveBeenCalledWith(authStub.currentUser, {
        __credential: true,
        email: 'person@example.com',
        password: 'hunter2',
      })
    })

    it('throws without calling Firebase when there is no email on the account', async () => {
      authStub.currentUser = { uid: 'u1', email: null }

      await expect(reauthenticateWithPassword('hunter2')).rejects.toThrow()
      expect(reauthenticateWithCredentialMock).not.toHaveBeenCalled()
    })
  })

  describe('deleteAuthAccount', () => {
    it('deletes the current Firebase Auth user', async () => {
      authStub.currentUser = { uid: 'u1' }
      deleteUserMock.mockResolvedValue(undefined)

      await deleteAuthAccount()

      expect(deleteUserMock).toHaveBeenCalledWith(authStub.currentUser)
    })

    it('throws without attempting anything when signed out', async () => {
      authStub.currentUser = null

      await expect(deleteAuthAccount()).rejects.toThrow()
      expect(deleteUserMock).not.toHaveBeenCalled()
    })
  })
})
