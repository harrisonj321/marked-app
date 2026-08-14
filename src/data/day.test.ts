import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDocsMock = vi.fn()
const batchUpdate = vi.fn()
const batchDelete = vi.fn()
const batchCommit = vi.fn()

function joinPath(parent: unknown, segments: string[]): string {
  const parentPath = (parent as { path?: string } | undefined)?.path ?? ''
  return [parentPath, ...segments].filter(Boolean).join('/')
}

vi.mock('firebase/firestore', () => ({
  collection: (parent: unknown, ...segments: string[]) => ({ path: joinPath(parent, segments) }),
  deleteDoc: vi.fn(),
  doc: (parent: unknown, ...segments: string[]) => ({ path: joinPath(parent, segments) }),
  documentId: vi.fn(),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  serverTimestamp: () => 'server-time',
  setDoc: vi.fn(),
  where: vi.fn(),
  writeBatch: () => ({ update: batchUpdate, delete: batchDelete, commit: batchCommit }),
}))
vi.mock('../lib/firebase', () => ({ db: {} }))

const { deleteLedgerDays, pinImplicitDayStates } = await import('./day')

const UID = 'user-1'
const LEDGER_ID = 'ledger-1'

function snapshotOf(records: Record<string, Record<string, unknown>>, basePath: string) {
  return {
    docs: Object.entries(records).map(([id, data]) => ({
      id,
      ref: { path: `${basePath}/${id}` },
      data: () => data,
    })),
  }
}

beforeEach(() => {
  getDocsMock.mockReset()
  batchUpdate.mockReset()
  batchDelete.mockReset()
  batchCommit.mockReset().mockResolvedValue(undefined)
})

describe('pinImplicitDayStates', () => {
  it('pins the state onto a count-only day so its count keeps its meaning', async () => {
    getDocsMock.mockResolvedValue(
      snapshotOf({ '2026-08-10': { count: 3 } }, `users/${UID}/ledgers/${LEDGER_ID}/days`),
    )

    await pinImplicitDayStates(UID, LEDGER_ID, 'did')

    expect(batchUpdate).toHaveBeenCalledWith(
      { path: `users/${UID}/ledgers/${LEDGER_ID}/days/2026-08-10` },
      { state: 'did', updatedAt: 'server-time' },
    )
    expect(batchCommit).toHaveBeenCalledTimes(1)
  })

  it('pins the state onto a note-only day', async () => {
    getDocsMock.mockResolvedValue(
      snapshotOf({ '2026-08-10': { note: 'Sick' } }, `users/${UID}/ledgers/${LEDGER_ID}/days`),
    )

    await pinImplicitDayStates(UID, LEDGER_ID, 'didnt')

    expect(batchUpdate).toHaveBeenCalledWith(expect.anything(), {
      state: 'didnt',
      updatedAt: 'server-time',
    })
  })

  it('leaves a day that already stores its own state untouched', async () => {
    getDocsMock.mockResolvedValue(
      snapshotOf(
        { '2026-08-10': { state: 'didnt', note: 'Sick' } },
        `users/${UID}/ledgers/${LEDGER_ID}/days`,
      ),
    )

    await pinImplicitDayStates(UID, LEDGER_ID, 'did')

    expect(batchUpdate).not.toHaveBeenCalled()
    expect(batchCommit).not.toHaveBeenCalled()
  })

  it('pins only the days that need it', async () => {
    getDocsMock.mockResolvedValue(
      snapshotOf(
        {
          '2026-08-09': { state: 'didnt' },
          '2026-08-10': { note: 'Hotel gym' },
          '2026-08-11': { count: 2 },
        },
        `users/${UID}/ledgers/${LEDGER_ID}/days`,
      ),
    )

    await pinImplicitDayStates(UID, LEDGER_ID, 'did')

    expect(batchUpdate).toHaveBeenCalledTimes(2)
    const pinned = batchUpdate.mock.calls.map((call) => call[0].path)
    expect(pinned).toEqual([
      `users/${UID}/ledgers/${LEDGER_ID}/days/2026-08-10`,
      `users/${UID}/ledgers/${LEDGER_ID}/days/2026-08-11`,
    ])
  })

  it('writes nothing when there are no day documents', async () => {
    getDocsMock.mockResolvedValue(snapshotOf({}, `users/${UID}/ledgers/${LEDGER_ID}/days`))

    await pinImplicitDayStates(UID, LEDGER_ID, 'did')

    expect(batchCommit).not.toHaveBeenCalled()
  })

  it('splits large histories across batches to stay under the write limit', async () => {
    const records: Record<string, Record<string, unknown>> = {}
    for (let index = 0; index < 401; index++) {
      records[`day-${index}`] = { note: 'n' }
    }
    getDocsMock.mockResolvedValue(snapshotOf(records, `users/${UID}/ledgers/${LEDGER_ID}/days`))

    await pinImplicitDayStates(UID, LEDGER_ID, 'did')

    expect(batchUpdate).toHaveBeenCalledTimes(401)
    expect(batchCommit).toHaveBeenCalledTimes(2)
  })

  it('reads from the legacy top-level days collection for the default ledger, not a ledgers subcollection', async () => {
    getDocsMock.mockResolvedValue(snapshotOf({ '2026-08-10': { count: 2 } }, `users/${UID}/days`))

    await pinImplicitDayStates(UID, 'default', 'did')

    expect(getDocsMock).toHaveBeenCalledWith({ path: `users/${UID}/days` })
    expect(batchUpdate).toHaveBeenCalledWith(
      { path: `users/${UID}/days/2026-08-10` },
      { state: 'did', updatedAt: 'server-time' },
    )
  })

  it('reads from a ledger subcollection for any non-default ledger', async () => {
    getDocsMock.mockResolvedValue(snapshotOf({}, `users/${UID}/ledgers/${LEDGER_ID}/days`))

    await pinImplicitDayStates(UID, LEDGER_ID, 'did')

    expect(getDocsMock).toHaveBeenCalledWith({ path: `users/${UID}/ledgers/${LEDGER_ID}/days` })
  })
})

describe('deleteLedgerDays', () => {
  it('deletes every day document', async () => {
    getDocsMock.mockResolvedValue(
      snapshotOf(
        { '2026-08-09': { state: 'did' }, '2026-08-10': { note: 'Sick' } },
        `users/${UID}/ledgers/${LEDGER_ID}/days`,
      ),
    )

    await deleteLedgerDays(UID, LEDGER_ID)

    expect(batchDelete).toHaveBeenCalledTimes(2)
    expect(batchCommit).toHaveBeenCalledTimes(1)
  })

  it('writes nothing when there are no day documents', async () => {
    getDocsMock.mockResolvedValue(snapshotOf({}, `users/${UID}/ledgers/${LEDGER_ID}/days`))

    await deleteLedgerDays(UID, LEDGER_ID)

    expect(batchDelete).not.toHaveBeenCalled()
    expect(batchCommit).not.toHaveBeenCalled()
  })

  it('splits large histories across batches', async () => {
    const records: Record<string, Record<string, unknown>> = {}
    for (let index = 0; index < 401; index++) {
      records[`day-${index}`] = { note: 'n' }
    }
    getDocsMock.mockResolvedValue(snapshotOf(records, `users/${UID}/ledgers/${LEDGER_ID}/days`))

    await deleteLedgerDays(UID, LEDGER_ID)

    expect(batchDelete).toHaveBeenCalledTimes(401)
    expect(batchCommit).toHaveBeenCalledTimes(2)
  })

  it('targets the legacy top-level days collection for the default ledger', async () => {
    getDocsMock.mockResolvedValue(snapshotOf({ '2026-08-10': { state: 'did' } }, `users/${UID}/days`))

    await deleteLedgerDays(UID, 'default')

    expect(getDocsMock).toHaveBeenCalledWith({ path: `users/${UID}/days` })
  })
})
