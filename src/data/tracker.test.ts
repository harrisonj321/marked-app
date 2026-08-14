import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDocMock = vi.fn()
const deleteDocMock = vi.fn()

vi.mock('firebase/firestore', () => ({
  doc: (...path: string[]) => ({ path: path.slice(1).join('/') }),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
}))
vi.mock('../lib/firebase', () => ({ db: {} }))

const { deleteLegacyTracker, getLegacyTracker } = await import('./tracker')

const UID = 'user-1'

beforeEach(() => {
  getDocMock.mockReset()
  deleteDocMock.mockReset().mockResolvedValue(undefined)
})

describe('getLegacyTracker', () => {
  it('maps the legacy tracker document', async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        name: 'Worked out',
        defaultState: 'did',
        timezone: 'America/Los_Angeles',
        startDate: '2026-08-01',
        stateLabels: { did: 'Took it', didnt: "Didn't take it" },
      }),
    })

    await expect(getLegacyTracker(UID)).resolves.toEqual({
      name: 'Worked out',
      defaultState: 'did',
      timezone: 'America/Los_Angeles',
      startDate: '2026-08-01',
      stateLabels: { did: 'Took it', didnt: "Didn't take it" },
    })
  })

  it('returns null for an account with no legacy tracker document', async () => {
    getDocMock.mockResolvedValue({ exists: () => false })
    await expect(getLegacyTracker(UID)).resolves.toBeNull()
  })
})

describe('deleteLegacyTracker', () => {
  it('deletes the legacy tracker/config document', async () => {
    await deleteLegacyTracker(UID)
    expect(deleteDocMock).toHaveBeenCalledWith({ path: `users/${UID}/tracker/config` })
  })
})
