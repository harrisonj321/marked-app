import { beforeEach, describe, expect, it, vi } from 'vitest'

const setDocMock = vi.fn()
const updateDocMock = vi.fn()
const deleteDocMock = vi.fn()
const getDocMock = vi.fn()
const getDocsMock = vi.fn()
const getLegacyTrackerMock = vi.fn()
const deleteLegacyTrackerMock = vi.fn()
const deleteLedgerDaysMock = vi.fn()
const pinImplicitDayStatesMock = vi.fn()

const DELETE_FIELD_SENTINEL = Symbol('deleteField')

function joinPath(parent: unknown, segments: string[]): string {
  const parentPath = (parent as { path?: string } | undefined)?.path ?? ''
  return [parentPath, ...segments].filter(Boolean).join('/')
}

vi.mock('firebase/firestore', () => ({
  collection: (parent: unknown, ...segments: string[]) => ({ path: joinPath(parent, segments) }),
  doc: (parent: unknown, ...segments: string[]) => ({
    path: joinPath(parent, segments),
    id: segments.length > 0 ? segments[segments.length - 1] : 'generated-id',
  }),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
  deleteField: () => DELETE_FIELD_SENTINEL,
  getDoc: (...args: unknown[]) => getDocMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: (...args: unknown[]) => args[0],
  serverTimestamp: () => 'server-time',
  setDoc: (...args: unknown[]) => setDocMock(...args),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
}))
vi.mock('../lib/firebase', () => ({ db: {} }))
vi.mock('./tracker', () => ({
  getLegacyTracker: (...args: unknown[]) => getLegacyTrackerMock(...args),
  deleteLegacyTracker: (...args: unknown[]) => deleteLegacyTrackerMock(...args),
}))
vi.mock('./day', () => ({
  deleteLedgerDays: (...args: unknown[]) => deleteLedgerDaysMock(...args),
  pinImplicitDayStates: (...args: unknown[]) => pinImplicitDayStatesMock(...args),
}))

const { createLedger, deleteLedger, listLedgerIds, migrateLegacyTrackerIfNeeded, updateLedgerColor, updateLedgerDefaultState, updateLedgerName, updateLedgerStateLabels } =
  await import('./ledger')
const { LEGACY_LEDGER_ID } = await import('../domain/ledger')

const UID = 'user-1'
const LEDGER_ID = 'ledger-1'

beforeEach(() => {
  setDocMock.mockReset().mockResolvedValue(undefined)
  updateDocMock.mockReset().mockResolvedValue(undefined)
  deleteDocMock.mockReset().mockResolvedValue(undefined)
  getDocMock.mockReset()
  getDocsMock.mockReset()
  getLegacyTrackerMock.mockReset()
  deleteLegacyTrackerMock.mockReset().mockResolvedValue(undefined)
  deleteLedgerDaysMock.mockReset().mockResolvedValue(undefined)
  pinImplicitDayStatesMock.mockReset().mockResolvedValue(undefined)
})

describe('createLedger', () => {
  it('writes the expected shape and returns the created ledger with its generated id', async () => {
    const created = await createLedger(UID, {
      name: 'Reading',
      defaultState: 'did',
      timezone: 'UTC',
      startDate: '2026-08-10',
    })

    expect(setDocMock).toHaveBeenCalledWith(expect.anything(), {
      name: 'Reading',
      defaultState: 'did',
      timezone: 'UTC',
      startDate: '2026-08-10',
      createdAt: 'server-time',
      updatedAt: 'server-time',
    })
    expect(created).toEqual({
      id: 'generated-id',
      name: 'Reading',
      defaultState: 'did',
      timezone: 'UTC',
      startDate: '2026-08-10',
      color: undefined,
      stateLabels: undefined,
    })
  })

  it('includes and returns stateLabels when provided by the creation form', async () => {
    const created = await createLedger(UID, {
      name: 'Reading',
      defaultState: 'did',
      stateLabels: { did: 'Yes', didnt: 'No' },
      timezone: 'UTC',
      startDate: '2026-08-10',
    })

    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ stateLabels: { did: 'Yes', didnt: 'No' } }),
    )
    expect(created).toEqual(
      expect.objectContaining({ stateLabels: { did: 'Yes', didnt: 'No' } }),
    )
  })

  it('includes color only when provided', async () => {
    await createLedger(UID, {
      name: 'Drinking',
      defaultState: 'didnt',
      timezone: 'UTC',
      startDate: '2026-08-10',
      color: 'moss',
    })

    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ color: 'moss' }),
    )
  })

  it("never assigns the legacy default id -- a brand-new account's first ledger always uses the new per-ledger days path", async () => {
    const created = await createLedger(UID, {
      name: 'Reading',
      defaultState: 'did',
      timezone: 'UTC',
      startDate: '2026-08-10',
    })

    expect(created.id).not.toBe(LEGACY_LEDGER_ID)
    // Firestore's own auto-id generation (doc() with no explicit id), not
    // any string this function could hardcode -- see data/day.ts's
    // daysCollection, which routes every id other than LEGACY_LEDGER_ID to
    // users/{uid}/ledgers/{id}/days.
    expect(setDocMock.mock.calls[0][0].id).not.toBe(LEGACY_LEDGER_ID)
  })
})

describe('listLedgerIds', () => {
  it('returns the id of every ledger doc in the collection', async () => {
    getDocsMock.mockResolvedValue({ docs: [{ id: 'ledger-1' }, { id: 'ledger-2' }] })

    const ids = await listLedgerIds(UID)

    expect(ids).toEqual(['ledger-1', 'ledger-2'])
  })

  it('returns an empty list for an account with no ledgers', async () => {
    getDocsMock.mockResolvedValue({ docs: [] })

    expect(await listLedgerIds(UID)).toEqual([])
  })
})

describe('updateLedgerName', () => {
  it('writes name and updatedAt', async () => {
    await updateLedgerName(UID, LEDGER_ID, 'Renamed')
    expect(updateDocMock).toHaveBeenCalledWith(expect.anything(), {
      name: 'Renamed',
      updatedAt: 'server-time',
    })
  })
})

describe('updateLedgerStateLabels', () => {
  it('writes both labels without touching defaultState', async () => {
    await updateLedgerStateLabels(UID, LEDGER_ID, { did: 'Took it', didnt: "Didn't take it" })
    expect(updateDocMock).toHaveBeenCalledWith(expect.anything(), {
      stateLabels: { did: 'Took it', didnt: "Didn't take it" },
      updatedAt: 'server-time',
    })
  })
})

describe('updateLedgerColor', () => {
  it('writes the given color', async () => {
    await updateLedgerColor(UID, LEDGER_ID, 'clay')
    expect(updateDocMock).toHaveBeenCalledWith(expect.anything(), {
      color: 'clay',
      updatedAt: 'server-time',
    })
  })

  it('removes the color entirely when passed null', async () => {
    await updateLedgerColor(UID, LEDGER_ID, null)
    expect(updateDocMock).toHaveBeenCalledWith(expect.anything(), {
      color: DELETE_FIELD_SENTINEL,
      updatedAt: 'server-time',
    })
  })
})

describe('updateLedgerDefaultState', () => {
  it('pins implicit states before writing the new default, scoped to this ledger', async () => {
    const order: string[] = []
    pinImplicitDayStatesMock.mockImplementation(() => {
      order.push('pin')
      return Promise.resolve()
    })
    updateDocMock.mockImplementation(() => {
      order.push('config')
      return Promise.resolve()
    })

    await updateLedgerDefaultState(UID, LEDGER_ID, 'did', 'didnt')

    expect(pinImplicitDayStatesMock).toHaveBeenCalledWith(UID, LEDGER_ID, 'did')
    expect(order).toEqual(['pin', 'config'])
  })

  it('does nothing when the default is unchanged', async () => {
    await updateLedgerDefaultState(UID, LEDGER_ID, 'did', 'did')
    expect(pinImplicitDayStatesMock).not.toHaveBeenCalled()
    expect(updateDocMock).not.toHaveBeenCalled()
  })

  it('leaves the default alone when pinning fails', async () => {
    pinImplicitDayStatesMock.mockRejectedValue(new Error('offline'))
    await expect(updateLedgerDefaultState(UID, LEDGER_ID, 'did', 'didnt')).rejects.toThrow()
    expect(updateDocMock).not.toHaveBeenCalled()
  })
})

describe('deleteLedger', () => {
  it('deletes the days before the ledger doc itself', async () => {
    const order: string[] = []
    deleteLedgerDaysMock.mockImplementation(() => {
      order.push('days')
      return Promise.resolve()
    })
    deleteDocMock.mockImplementation(() => {
      order.push('ledger')
      return Promise.resolve()
    })

    await deleteLedger(UID, LEDGER_ID)

    expect(deleteLedgerDaysMock).toHaveBeenCalledWith(UID, LEDGER_ID)
    expect(order).toEqual(['days', 'ledger'])
  })

  it('never touches the legacy tracker doc for an ordinary (non-default) ledger', async () => {
    await deleteLedger(UID, LEDGER_ID)
    expect(deleteLegacyTrackerMock).not.toHaveBeenCalled()
  })

  it('also retires the legacy tracker doc when the migrated default ledger is deleted, before anything else', async () => {
    const order: string[] = []
    deleteLegacyTrackerMock.mockImplementation(() => {
      order.push('legacy-tracker')
      return Promise.resolve()
    })
    deleteLedgerDaysMock.mockImplementation(() => {
      order.push('days')
      return Promise.resolve()
    })
    deleteDocMock.mockImplementation(() => {
      order.push('ledger')
      return Promise.resolve()
    })

    await deleteLedger(UID, LEGACY_LEDGER_ID)

    expect(deleteLegacyTrackerMock).toHaveBeenCalledWith(UID)
    expect(order).toEqual(['legacy-tracker', 'days', 'ledger'])
  })

  it('leaves the ledger and its days untouched when retiring the legacy tracker fails, so the whole deletion is safely retryable', async () => {
    deleteLegacyTrackerMock.mockRejectedValue(new Error('offline'))

    await expect(deleteLedger(UID, LEGACY_LEDGER_ID)).rejects.toThrow()

    expect(deleteLedgerDaysMock).not.toHaveBeenCalled()
    expect(deleteDocMock).not.toHaveBeenCalled()
  })
})

describe('migrateLegacyTrackerIfNeeded', () => {
  it('returns the existing default ledger untouched if migration already ran', async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      id: 'default',
      data: () => ({ name: 'Worked out', defaultState: 'did', timezone: 'UTC', startDate: '2026-08-01' }),
    })

    const result = await migrateLegacyTrackerIfNeeded(UID)

    expect(result).toEqual({
      id: 'default',
      name: 'Worked out',
      defaultState: 'did',
      timezone: 'UTC',
      startDate: '2026-08-01',
      stateLabels: undefined,
      color: undefined,
    })
    expect(getLegacyTrackerMock).not.toHaveBeenCalled()
    expect(setDocMock).not.toHaveBeenCalled()
  })

  it('returns null for a genuinely new account with no legacy tracker', async () => {
    getDocMock.mockResolvedValue({ exists: () => false })
    getLegacyTrackerMock.mockResolvedValue(null)

    const result = await migrateLegacyTrackerIfNeeded(UID)

    expect(result).toBeNull()
    expect(setDocMock).not.toHaveBeenCalled()
  })

  it('mirrors the legacy tracker into ledgers/default without touching its days', async () => {
    getDocMock.mockResolvedValue({ exists: () => false })
    getLegacyTrackerMock.mockResolvedValue({
      name: 'Worked out',
      defaultState: 'did',
      timezone: 'America/Los_Angeles',
      startDate: '2026-08-01',
      stateLabels: { did: 'Took it', didnt: "Didn't take it" },
    })

    const result = await migrateLegacyTrackerIfNeeded(UID)

    expect(setDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: `users/${UID}/ledgers/default` }),
      {
        name: 'Worked out',
        defaultState: 'did',
        timezone: 'America/Los_Angeles',
        startDate: '2026-08-01',
        stateLabels: { did: 'Took it', didnt: "Didn't take it" },
        createdAt: 'server-time',
        updatedAt: 'server-time',
      },
    )
    expect(result).toEqual({
      id: 'default',
      name: 'Worked out',
      defaultState: 'did',
      timezone: 'America/Los_Angeles',
      startDate: '2026-08-01',
      stateLabels: { did: 'Took it', didnt: "Didn't take it" },
    })
  })

  it('omits stateLabels from the write when the legacy tracker never customized them', async () => {
    getDocMock.mockResolvedValue({ exists: () => false })
    getLegacyTrackerMock.mockResolvedValue({
      name: 'Worked out',
      defaultState: 'did',
      timezone: 'UTC',
      startDate: '2026-08-01',
    })

    await migrateLegacyTrackerIfNeeded(UID)

    const written = setDocMock.mock.calls[0][1]
    expect(written).not.toHaveProperty('stateLabels')
  })
})

describe('deleted-ledger resurrection across a fresh session', () => {
  /**
   * migrateLegacyTrackerIfNeeded and deleteLedger are both plain stateless
   * async functions -- neither holds any module-level or closure state of
   * its own. So calling migrateLegacyTrackerIfNeeded independently *after*
   * a deleteLedger call, in the same way a brand-new useLedgers hook
   * instance would on a full app reload or sign-out/sign-in, is a faithful
   * proof of the cross-session guarantee: nothing about this test relies
   * on any single hook instance's lifetime, unlike the in-memory
   * migratedForUid guard in useLedgers, which by itself cannot prevent
   * this across a fresh session.
   */
  it('does not resurrect the deleted default ledger, because deleteLedger already retired the legacy tracker doc it would have been rebuilt from', async () => {
    // Step 1: the user deletes their migrated "default" ledger.
    await deleteLedger(UID, LEGACY_LEDGER_ID)
    expect(deleteLegacyTrackerMock).toHaveBeenCalledWith(UID)

    // Step 2: a completely fresh session (new tab, reload, or sign back
    // in) mounts a brand-new useLedgers hook, which finds the ledgers
    // list empty and calls migrateLegacyTrackerIfNeeded from scratch --
    // reflected here by both Firestore reads now coming back empty, since
    // both ledgers/default and tracker/config are actually gone.
    getDocMock.mockResolvedValue({ exists: () => false })
    getLegacyTrackerMock.mockResolvedValue(null)

    const result = await migrateLegacyTrackerIfNeeded(UID)

    expect(result).toBeNull()
    expect(setDocMock).not.toHaveBeenCalled()
  })
})
