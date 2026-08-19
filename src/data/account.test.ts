import { beforeEach, describe, expect, it, vi } from 'vitest'

const listLedgerIdsMock = vi.fn()
const deleteLedgerMock = vi.fn()
const deleteLedgerDaysMock = vi.fn()
const deleteLegacyTrackerMock = vi.fn()
const deleteAppSettingsMock = vi.fn()

vi.mock('./ledger', () => ({
  listLedgerIds: (...args: unknown[]) => listLedgerIdsMock(...args),
  deleteLedger: (...args: unknown[]) => deleteLedgerMock(...args),
}))
vi.mock('./day', () => ({
  deleteLedgerDays: (...args: unknown[]) => deleteLedgerDaysMock(...args),
}))
vi.mock('./tracker', () => ({
  deleteLegacyTracker: (...args: unknown[]) => deleteLegacyTrackerMock(...args),
}))
vi.mock('./appSettings', () => ({
  deleteAppSettings: (...args: unknown[]) => deleteAppSettingsMock(...args),
}))

const { deleteAllUserData } = await import('./account')

beforeEach(() => {
  listLedgerIdsMock.mockReset().mockResolvedValue([])
  deleteLedgerMock.mockReset().mockResolvedValue(undefined)
  deleteLedgerDaysMock.mockReset().mockResolvedValue(undefined)
  deleteLegacyTrackerMock.mockReset().mockResolvedValue(undefined)
  deleteAppSettingsMock.mockReset().mockResolvedValue(undefined)
})

describe('deleteAllUserData', () => {
  it('deletes every ledger the account owns', async () => {
    listLedgerIdsMock.mockResolvedValue(['ledger-1', 'ledger-2'])

    await deleteAllUserData('u1')

    expect(deleteLedgerMock).toHaveBeenCalledWith('u1', 'ledger-1')
    expect(deleteLedgerMock).toHaveBeenCalledWith('u1', 'ledger-2')
  })

  it('always also retires the legacy tracker/days and settings/app, even with no ledgers', async () => {
    listLedgerIdsMock.mockResolvedValue([])

    await deleteAllUserData('u1')

    expect(deleteLedgerMock).not.toHaveBeenCalled()
    expect(deleteLedgerDaysMock).toHaveBeenCalledWith('u1', 'default')
    expect(deleteLegacyTrackerMock).toHaveBeenCalledWith('u1')
    expect(deleteAppSettingsMock).toHaveBeenCalledWith('u1')
  })

  it('covers the legacy tracker/days defensively even when "default" was already among the deleted ledgers', async () => {
    listLedgerIdsMock.mockResolvedValue(['default'])

    await deleteAllUserData('u1')

    expect(deleteLedgerMock).toHaveBeenCalledWith('u1', 'default')
    expect(deleteLedgerDaysMock).toHaveBeenCalledWith('u1', 'default')
    expect(deleteLegacyTrackerMock).toHaveBeenCalledWith('u1')
  })

  it('deletes settings/app last, after every ledger is gone', async () => {
    listLedgerIdsMock.mockResolvedValue(['ledger-1'])
    const order: string[] = []
    deleteLedgerMock.mockImplementation(async () => {
      order.push('ledger')
    })
    deleteAppSettingsMock.mockImplementation(async () => {
      order.push('settings')
    })

    await deleteAllUserData('u1')

    expect(order).toEqual(['ledger', 'settings'])
  })

  it('propagates a failure without deleting settings/app, so a partial run is safely retryable', async () => {
    listLedgerIdsMock.mockResolvedValue(['ledger-1'])
    deleteLedgerMock.mockRejectedValue(new Error('offline'))

    await expect(deleteAllUserData('u1')).rejects.toThrow('offline')
    expect(deleteAppSettingsMock).not.toHaveBeenCalled()
  })
})
