import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { subscribeAuthUserMock, resolveGoogleRedirectMock } = vi.hoisted(() => ({
  subscribeAuthUserMock: vi.fn(),
  resolveGoogleRedirectMock: vi.fn(),
}))

vi.mock('../lib/auth', () => ({
  subscribeAuthUser: subscribeAuthUserMock,
  resolveGoogleRedirect: resolveGoogleRedirectMock,
}))

const { useAuthUser } = await import('./useAuthUser')

function latestAuthStateChangeCallback() {
  const call = subscribeAuthUserMock.mock.calls.at(-1) as
    | [(user: { uid: string } | null) => void]
    | undefined
  return call?.[0]
}

describe('useAuthUser', () => {
  it('starts in a loading state', () => {
    resolveGoogleRedirectMock.mockReturnValue(new Promise(() => {})) // never resolves
    subscribeAuthUserMock.mockReturnValue(vi.fn())

    const { result } = renderHook(() => useAuthUser())

    expect(result.current).toEqual({ user: null, loading: true, authError: null })
  })

  it('resolves loading to false once onAuthStateChanged reports no session', async () => {
    resolveGoogleRedirectMock.mockResolvedValue(undefined)
    subscribeAuthUserMock.mockReturnValue(vi.fn())

    const { result } = renderHook(() => useAuthUser())
    latestAuthStateChangeCallback()?.(null)

    await waitFor(() => {
      expect(result.current).toEqual({ user: null, loading: false, authError: null })
    })
  })

  it('resolves loading to false with the signed-in user once onAuthStateChanged reports a session', async () => {
    resolveGoogleRedirectMock.mockResolvedValue(undefined)
    subscribeAuthUserMock.mockReturnValue(vi.fn())
    const user = { uid: 'u1' }

    const { result } = renderHook(() => useAuthUser())
    latestAuthStateChangeCallback()?.(user)

    await waitFor(() => {
      expect(result.current).toEqual({ user, loading: false, authError: null })
    })
  })

  /**
   * The core anti-regression case for the splash-screen-that-never-resolves
   * bug: onAuthStateChanged is the only thing `loading` waits on. A Google
   * redirect result that hangs forever (network stall, a still-processing
   * OAuth callback, anything) must never block boot -- see CLAUDE.md's
   * splash-screen requirement, which explicitly forbids papering over this
   * with a timeout instead of a real fix.
   */
  it('resolves loading to false even when resolving the Google redirect never settles', async () => {
    resolveGoogleRedirectMock.mockReturnValue(new Promise(() => {})) // never resolves
    subscribeAuthUserMock.mockReturnValue(vi.fn())

    const { result } = renderHook(() => useAuthUser())
    latestAuthStateChangeCallback()?.(null)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  /**
   * The exact real-device shape of the post-Google-sign-in hang: the
   * redirect just completed and the user IS now authenticated, but
   * getRedirectResult itself never settles (was hanging indefinitely on
   * iOS -- see the service-worker fix in vite.config.ts, which was
   * intercepting the redirect navigation before this hook's code ever ran
   * meaningfully). onAuthStateChanged reporting the signed-in user, on its
   * own, must still be enough to clear loading and hand back that user --
   * "the splash must clear and the app must continue" is not just "loading
   * becomes false", it's specifically "with the authenticated user
   * attached", since that is what lets App proceed past SignIn.
   */
  it('resolves loading to false with the authenticated user even when resolving the Google redirect never settles', async () => {
    resolveGoogleRedirectMock.mockReturnValue(new Promise(() => {})) // never resolves
    subscribeAuthUserMock.mockReturnValue(vi.fn())
    const user = { uid: 'u1' }

    const { result } = renderHook(() => useAuthUser())
    latestAuthStateChangeCallback()?.(user)

    await waitFor(() => {
      expect(result.current).toEqual({ user, loading: false, authError: null })
    })
  })

  it('resolves loading to false and surfaces the mapped error when the Google redirect failed', async () => {
    resolveGoogleRedirectMock.mockRejectedValue({ code: 'auth/network-request-failed' })
    subscribeAuthUserMock.mockReturnValue(vi.fn())

    const { result } = renderHook(() => useAuthUser())
    latestAuthStateChangeCallback()?.(null)

    await waitFor(() => {
      expect(result.current).toEqual({
        user: null,
        loading: false,
        authError: 'Network error. Check your connection and try again.',
      })
    })
  })

  it('does not surface a redirect error after unmount', async () => {
    let rejectRedirect: (err: unknown) => void = () => {}
    resolveGoogleRedirectMock.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRedirect = reject
      }),
    )
    subscribeAuthUserMock.mockReturnValue(vi.fn())

    const { unmount } = renderHook(() => useAuthUser())
    unmount()
    rejectRedirect({ code: 'auth/network-request-failed' })

    // Nothing to assert on `result` post-unmount; this only proves the
    // late rejection doesn't throw an unhandled/state-on-unmounted error.
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('unsubscribes from auth state changes on unmount', () => {
    const unsubscribe = vi.fn()
    resolveGoogleRedirectMock.mockReturnValue(new Promise(() => {}))
    subscribeAuthUserMock.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useAuthUser())
    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
