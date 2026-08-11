import { beforeEach, describe, expect, it, vi } from 'vitest'

const updateDocMock = vi.fn()
const pinImplicitDayStatesMock = vi.fn()

vi.mock('firebase/firestore', () => ({
  doc: (...path: string[]) => ({ path: path.slice(1).join('/') }),
  onSnapshot: vi.fn(),
  serverTimestamp: () => 'server-time',
  setDoc: vi.fn(),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
}))
vi.mock('../lib/firebase', () => ({ db: {} }))
vi.mock('./day', () => ({
  pinImplicitDayStates: (...args: unknown[]) => pinImplicitDayStatesMock(...args),
}))

const { updateTrackerDefaultState } = await import('./tracker')

const UID = 'user-1'

beforeEach(() => {
  updateDocMock.mockReset().mockResolvedValue(undefined)
  pinImplicitDayStatesMock.mockReset().mockResolvedValue(undefined)
})

describe('updateTrackerDefaultState', () => {
  it('pins the states days already resolve to before changing the default', async () => {
    const order: string[] = []
    pinImplicitDayStatesMock.mockImplementation(() => {
      order.push('pin')
      return Promise.resolve()
    })
    updateDocMock.mockImplementation(() => {
      order.push('config')
      return Promise.resolve()
    })

    await updateTrackerDefaultState(UID, 'did', 'didnt')

    expect(pinImplicitDayStatesMock).toHaveBeenCalledWith(UID, 'did')
    expect(order).toEqual(['pin', 'config'])
  })

  it('writes the new default state on the tracker config', async () => {
    await updateTrackerDefaultState(UID, 'did', 'didnt')

    expect(updateDocMock).toHaveBeenCalledWith(expect.anything(), {
      defaultState: 'didnt',
      updatedAt: 'server-time',
    })
  })

  it('pins the previous default, not the new one', async () => {
    await updateTrackerDefaultState(UID, 'didnt', 'did')
    expect(pinImplicitDayStatesMock).toHaveBeenCalledWith(UID, 'didnt')
  })

  it('does nothing when the default is unchanged', async () => {
    await updateTrackerDefaultState(UID, 'did', 'did')

    expect(pinImplicitDayStatesMock).not.toHaveBeenCalled()
    expect(updateDocMock).not.toHaveBeenCalled()
  })

  it('leaves the default alone when pinning fails, so no day silently re-resolves', async () => {
    pinImplicitDayStatesMock.mockRejectedValue(new Error('offline'))

    await expect(updateTrackerDefaultState(UID, 'did', 'didnt')).rejects.toThrow()
    expect(updateDocMock).not.toHaveBeenCalled()
  })
})
