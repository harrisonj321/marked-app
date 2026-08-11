import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDocsMock = vi.fn()
const batchUpdate = vi.fn()
const batchCommit = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: (...path: string[]) => ({ path: path.slice(1).join('/') }),
  deleteDoc: vi.fn(),
  doc: (...path: string[]) => ({ path: path.slice(1).join('/') }),
  documentId: vi.fn(),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  serverTimestamp: () => 'server-time',
  setDoc: vi.fn(),
  where: vi.fn(),
  writeBatch: () => ({ update: batchUpdate, commit: batchCommit }),
}))
vi.mock('../lib/firebase', () => ({ db: {} }))

const { pinImplicitDayStates } = await import('./day')

const UID = 'user-1'

function snapshotOf(records: Record<string, Record<string, unknown>>) {
  return {
    docs: Object.entries(records).map(([id, data]) => ({
      id,
      ref: { path: `users/${UID}/days/${id}` },
      data: () => data,
    })),
  }
}

beforeEach(() => {
  getDocsMock.mockReset()
  batchUpdate.mockReset()
  batchCommit.mockReset().mockResolvedValue(undefined)
})

describe('pinImplicitDayStates', () => {
  it('pins the state onto a count-only day so its count keeps its meaning', async () => {
    getDocsMock.mockResolvedValue(snapshotOf({ '2026-08-10': { count: 3 } }))

    await pinImplicitDayStates(UID, 'did')

    expect(batchUpdate).toHaveBeenCalledWith(
      { path: `users/${UID}/days/2026-08-10` },
      { state: 'did', updatedAt: 'server-time' },
    )
    expect(batchCommit).toHaveBeenCalledTimes(1)
  })

  it('pins the state onto a note-only day', async () => {
    getDocsMock.mockResolvedValue(snapshotOf({ '2026-08-10': { note: 'Sick' } }))

    await pinImplicitDayStates(UID, 'didnt')

    expect(batchUpdate).toHaveBeenCalledWith(expect.anything(), {
      state: 'didnt',
      updatedAt: 'server-time',
    })
  })

  it('leaves a day that already stores its own state untouched', async () => {
    getDocsMock.mockResolvedValue(
      snapshotOf({ '2026-08-10': { state: 'didnt', note: 'Sick' } }),
    )

    await pinImplicitDayStates(UID, 'did')

    expect(batchUpdate).not.toHaveBeenCalled()
    expect(batchCommit).not.toHaveBeenCalled()
  })

  it('pins only the days that need it', async () => {
    getDocsMock.mockResolvedValue(
      snapshotOf({
        '2026-08-09': { state: 'didnt' },
        '2026-08-10': { note: 'Hotel gym' },
        '2026-08-11': { count: 2 },
      }),
    )

    await pinImplicitDayStates(UID, 'did')

    expect(batchUpdate).toHaveBeenCalledTimes(2)
    const pinned = batchUpdate.mock.calls.map((call) => call[0].path)
    expect(pinned).toEqual([
      `users/${UID}/days/2026-08-10`,
      `users/${UID}/days/2026-08-11`,
    ])
  })

  it('writes nothing when there are no day documents', async () => {
    getDocsMock.mockResolvedValue(snapshotOf({}))

    await pinImplicitDayStates(UID, 'did')

    expect(batchCommit).not.toHaveBeenCalled()
  })

  it('splits large histories across batches to stay under the write limit', async () => {
    const records: Record<string, Record<string, unknown>> = {}
    for (let index = 0; index < 401; index++) {
      records[`day-${index}`] = { note: 'n' }
    }
    getDocsMock.mockResolvedValue(snapshotOf(records))

    await pinImplicitDayStates(UID, 'did')

    expect(batchUpdate).toHaveBeenCalledTimes(401)
    expect(batchCommit).toHaveBeenCalledTimes(2)
  })
})
