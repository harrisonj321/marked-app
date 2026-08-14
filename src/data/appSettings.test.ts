import { beforeEach, describe, expect, it, vi } from 'vitest'

const setDocMock = vi.fn()
const onSnapshotMock = vi.fn()

vi.mock('firebase/firestore', () => ({
  doc: (...path: string[]) => ({ path: path.slice(1).join('/') }),
  onSnapshot: (...args: unknown[]) => onSnapshotMock(...args),
  serverTimestamp: () => 'server-time',
  setDoc: (...args: unknown[]) => setDocMock(...args),
}))
vi.mock('../lib/firebase', () => ({ db: {} }))

const { setActiveLedgerId, subscribeActiveLedgerId } = await import('./appSettings')

const UID = 'user-1'

beforeEach(() => {
  setDocMock.mockReset().mockResolvedValue(undefined)
  onSnapshotMock.mockReset()
})

describe('setActiveLedgerId', () => {
  it('writes the full doc shape', async () => {
    await setActiveLedgerId(UID, 'ledger-1')
    expect(setDocMock).toHaveBeenCalledWith(expect.anything(), {
      activeLedgerId: 'ledger-1',
      updatedAt: 'server-time',
    })
  })
})

describe('subscribeActiveLedgerId', () => {
  it('reports the stored id', () => {
    const onChange = vi.fn()
    subscribeActiveLedgerId(UID, onChange)

    const [, snapshotCallback] = onSnapshotMock.mock.calls[0] as [unknown, (snapshot: unknown) => void]
    snapshotCallback({ data: () => ({ activeLedgerId: 'ledger-1' }) })

    expect(onChange).toHaveBeenCalledWith('ledger-1')
  })

  it('reports null when the document does not exist yet', () => {
    const onChange = vi.fn()
    subscribeActiveLedgerId(UID, onChange)

    const [, snapshotCallback] = onSnapshotMock.mock.calls[0] as [unknown, (snapshot: unknown) => void]
    snapshotCallback({ data: () => undefined })

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('reports null for a malformed stored value', () => {
    const onChange = vi.fn()
    subscribeActiveLedgerId(UID, onChange)

    const [, snapshotCallback] = onSnapshotMock.mock.calls[0] as [unknown, (snapshot: unknown) => void]
    snapshotCallback({ data: () => ({ activeLedgerId: 42 }) })

    expect(onChange).toHaveBeenCalledWith(null)
  })
})
