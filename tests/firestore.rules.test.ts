import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

const PROJECT_ID = 'noted-app-rules-test'
const OWNER_UID = 'owner-uid'
const OTHER_UID = 'other-uid'

const validTracker = {
  name: 'Worked out',
  defaultState: 'did',
  timezone: 'America/Los_Angeles',
  startDate: '2026-08-10',
}

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

function dbAs(uid: string | null) {
  return uid ? testEnv.authenticatedContext(uid).firestore() : testEnv.unauthenticatedContext().firestore()
}

async function seedTracker(uid: string, data: Record<string, unknown> = validTracker) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `users/${uid}/tracker/config`), {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })
}

async function seedDayDoc(uid: string, dateKey: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `users/${uid}/days/${dateKey}`), {
      ...data,
      updatedAt: new Date(),
    })
  })
}

const validLedger = {
  name: 'Reading',
  defaultState: 'did',
  timezone: 'America/Los_Angeles',
  startDate: '2026-08-10',
}

async function seedLedger(uid: string, ledgerId: string, data: Record<string, unknown> = validLedger) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `users/${uid}/ledgers/${ledgerId}`), {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })
}

async function seedLedgerDayDoc(
  uid: string,
  ledgerId: string,
  dateKey: string,
  data: Record<string, unknown>,
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `users/${uid}/ledgers/${ledgerId}/days/${dateKey}`), {
      ...data,
      updatedAt: new Date(),
    })
  })
}

describe('tracker config', () => {
  it('authenticated owner can create their tracker', async () => {
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('unauthenticated user cannot read or write the tracker', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(null)
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}/tracker/config`)))
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('another authenticated user cannot read the tracker', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OTHER_UID)
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}/tracker/config`)))
  })

  it('another authenticated user cannot modify the tracker', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OTHER_UID)
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/tracker/config`), { name: 'Hijacked' }),
    )
  })

  it('another authenticated user cannot create a tracker for a different uid', async () => {
    const db = dbAs(OTHER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('owner can read the tracker and update the name', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OWNER_UID)
    await assertSucceeds(getDoc(doc(db, `users/${OWNER_UID}/tracker/config`)))
    await assertSucceeds(
      updateDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        name: 'Renamed',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects an unrecognized field on create', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        extra: 'not allowed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects an invalid default state', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        defaultState: 'sometimes',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a whitespace-only name', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        name: '   ',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects an empty name', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        name: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a name over the maximum length', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        name: 'a'.repeat(61),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a malformed start date', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        startDate: '08/10/2026',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('owner can change defaultState on update', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      updateDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        defaultState: 'didnt',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects an invalid defaultState value on update', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OWNER_UID)
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        defaultState: 'sometimes',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('another authenticated user cannot change defaultState', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OTHER_UID)
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        defaultState: 'didnt',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects changing startDate on update', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OWNER_UID)
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        startDate: '2099-01-01',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects changing timezone on update', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OWNER_UID)
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        timezone: 'UTC',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects changing createdAt on update', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OWNER_UID)
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects an unrecognized field on update', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OWNER_UID)
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        extra: 'not allowed',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects an invalid name on update', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OWNER_UID)
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        name: '   ',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('denies any document under tracker/ other than config', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/other`), {
        ...validTracker,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  // The client deletes this doc when the ledgers/default ledger migrated
  // from it is itself deleted (see data/ledger.ts's deleteLedger) -- so
  // that a fresh session's migration check has nothing left to resurrect
  // that ledger from.
  it('owner can delete their own legacy tracker document', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OWNER_UID)
    await assertSucceeds(deleteDoc(doc(db, `users/${OWNER_UID}/tracker/config`)))
  })

  it('another authenticated user cannot delete someone else\'s legacy tracker document', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OTHER_UID)
    await assertFails(deleteDoc(doc(db, `users/${OWNER_UID}/tracker/config`)))
  })

  it('unauthenticated user cannot delete a legacy tracker document', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(null)
    await assertFails(deleteDoc(doc(db, `users/${OWNER_UID}/tracker/config`)))
  })
})

describe('tracker config -- stateLabels', () => {
  it('allows creating a tracker with valid stateLabels', async () => {
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        stateLabels: { did: 'Took it', didnt: "Didn't take it" },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('allows creating a tracker with no stateLabels at all', async () => {
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('owner can rename both labels on update', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      updateDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        stateLabels: { did: 'Took it', didnt: "Didn't take it" },
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects stateLabels missing the didnt key', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        stateLabels: { did: 'Took it' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects an unrecognized key inside stateLabels', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        stateLabels: { did: 'Took it', didnt: "Didn't take it", extra: 'nope' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a whitespace-only label', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        stateLabels: { did: '   ', didnt: "Didn't take it" },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a label over the maximum length', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        ...validTracker,
        stateLabels: { did: 'a'.repeat(25), didnt: "Didn't take it" },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('another authenticated user cannot rename labels', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OTHER_UID)
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/tracker/config`), {
        stateLabels: { did: 'Hijacked', didnt: "Didn't take it" },
        updatedAt: serverTimestamp(),
      }),
    )
  })
})

describe('daily entries -- ownership and shape', () => {
  it('owner can create, read, and delete their own daily override', async () => {
    const db = dbAs(OWNER_UID)
    const ref = doc(db, `users/${OWNER_UID}/days/2026-08-10`)
    await assertSucceeds(setDoc(ref, { state: 'didnt', updatedAt: serverTimestamp() }))
    await assertSucceeds(getDoc(ref))
    await assertSucceeds(deleteDoc(ref))
  })

  it('another user cannot read or delete a daily override', async () => {
    await seedDayDoc(OWNER_UID, '2026-08-10', { state: 'did' })
    const db = dbAs(OTHER_UID)
    const ref = doc(db, `users/${OWNER_UID}/days/2026-08-10`)
    await assertFails(getDoc(ref))
    await assertFails(deleteDoc(ref))
  })

  it('another authenticated user cannot create a daily override for a different uid', async () => {
    const db = dbAs(OTHER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        state: 'did',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('unauthenticated user cannot read or write a daily override', async () => {
    await seedDayDoc(OWNER_UID, '2026-08-10', { state: 'did' })
    const db = dbAs(null)
    const ref = doc(db, `users/${OWNER_UID}/days/2026-08-10`)
    await assertFails(getDoc(ref))
    await assertFails(setDoc(ref, { state: 'did', updatedAt: serverTimestamp() }))
  })

  it('rejects an invalid daily state', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        state: 'maybe',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects an unrecognized field', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        state: 'did',
        updatedAt: serverTimestamp(),
        tag: 'not supported',
      }),
    )
  })

  it('rejects a document with only updatedAt and no explicit field', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a malformed day document id', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/days/not-a-date`), {
        state: 'did',
        updatedAt: serverTimestamp(),
      }),
    )
  })
})

describe('daily entries -- notes', () => {
  it('allows a note-only document on an otherwise default-state day', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        note: 'Hotel gym',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('allows a valid note alongside a state override', async () => {
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        state: 'didnt',
        note: 'Sick',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a note over the length limit', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        note: 'a'.repeat(121),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a whitespace-only note', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        note: '   ',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('removes the state override while preserving the note', async () => {
    await seedTracker(OWNER_UID) // defaultState: did
    await seedDayDoc(OWNER_UID, '2026-08-10', { state: 'didnt', note: 'Sick' })
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        note: 'Sick',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('removes the note while preserving the state override', async () => {
    await seedDayDoc(OWNER_UID, '2026-08-10', { state: 'didnt', note: 'Sick' })
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        state: 'didnt',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('allows deleting the entire day document', async () => {
    await seedDayDoc(OWNER_UID, '2026-08-10', { note: 'Sick' })
    const db = dbAs(OWNER_UID)
    await assertSucceeds(deleteDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`)))
  })
})

describe('daily entries -- counts', () => {
  it('allows a valid count greater than one on an explicit did day', async () => {
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        state: 'did',
        count: 3,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('allows a valid count when the day is did via the tracker default alone', async () => {
    await seedTracker(OWNER_UID) // defaultState: did
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        count: 4,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a count on an explicit didnt day', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        state: 'didnt',
        count: 2,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a count when the tracker default makes the day effectively didnt', async () => {
    await seedTracker(OWNER_UID, { ...validTracker, defaultState: 'didnt' })
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        count: 2,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('allows pinning the implicit did state onto a count-only day before a default change', async () => {
    await seedTracker(OWNER_UID) // defaultState: did
    await seedDayDoc(OWNER_UID, '2026-08-10', { count: 3 })
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      updateDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        state: 'did',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('allows pinning a state onto a note-only day', async () => {
    await seedTracker(OWNER_UID)
    await seedDayDoc(OWNER_UID, '2026-08-10', { note: 'Sick' })
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      updateDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        state: 'did',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a non-integer count', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        state: 'did',
        count: 2.5,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a count of one -- it must be implicit, not stored', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        state: 'did',
        count: 1,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a count above the maximum', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/days/2026-08-10`), {
        state: 'did',
        count: 100,
        updatedAt: serverTimestamp(),
      }),
    )
  })
})

describe('ledgers', () => {
  it('authenticated owner can create a ledger', async () => {
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        ...validLedger,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('allows more than one ledger for the same owner, unlike the single legacy tracker doc', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-2`), {
        ...validLedger,
        name: 'Drinking',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('unauthenticated user cannot read or write a ledger', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    const db = dbAs(null)
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`)))
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        ...validLedger,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('another authenticated user cannot read, create, or update a ledger', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    const db = dbAs(OTHER_UID)
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`)))
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-2`), {
        ...validLedger,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        name: 'Hijacked',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('owner can read the ledger and rename it', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    const db = dbAs(OWNER_UID)
    await assertSucceeds(getDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`)))
    await assertSucceeds(
      updateDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        name: 'Renamed',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('owner can change defaultState on update', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      updateDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        defaultState: 'didnt',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects changing timezone, startDate, or createdAt on update', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    const db = dbAs(OWNER_UID)
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        timezone: 'UTC',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        startDate: '2099-01-01',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects an unrecognized field', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        ...validLedger,
        extra: 'not allowed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects an invalid default state', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        ...validLedger,
        defaultState: 'sometimes',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a whitespace-only name', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        ...validLedger,
        name: '   ',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('denies a write to any subcollection other than days', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1/notARealSubcollection/x`), {
        anything: true,
      }),
    )
  })
})

describe('ledgers -- color', () => {
  it('allows creating a ledger with a valid color', async () => {
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        ...validLedger,
        color: 'clay',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('allows creating a ledger with the espresso default color', async () => {
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        ...validLedger,
        color: 'espresso',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('allows creating a ledger with no color at all', async () => {
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        ...validLedger,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a color outside the fixed palette, including freeform hex', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        ...validLedger,
        color: '#ff0000',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('owner can set a color on update', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      updateDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        color: 'moss',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('owner can set the color to espresso on update, same as any other palette color', async () => {
    await seedLedger(OWNER_UID, 'ledger-1', { ...validLedger, color: 'clay' })
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      updateDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        color: 'espresso',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('owner can remove a color on update', async () => {
    await seedLedger(OWNER_UID, 'ledger-1', { ...validLedger, color: 'clay' })
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      updateDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        color: deleteField(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('another authenticated user cannot change the color', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    const db = dbAs(OTHER_UID)
    await assertFails(
      updateDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1`), {
        color: 'moss',
        updatedAt: serverTimestamp(),
      }),
    )
  })
})

describe('ledger days', () => {
  it('owner can create, read, and delete a day within a ledger', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    const db = dbAs(OWNER_UID)
    const ref = doc(db, `users/${OWNER_UID}/ledgers/ledger-1/days/2026-08-10`)
    await assertSucceeds(setDoc(ref, { state: 'didnt', updatedAt: serverTimestamp() }))
    await assertSucceeds(getDoc(ref))
    await assertSucceeds(deleteDoc(ref))
  })

  it('another user cannot read, write, or delete a day within someone else\'s ledger', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    await seedLedgerDayDoc(OWNER_UID, 'ledger-1', '2026-08-10', { state: 'did' })
    const db = dbAs(OTHER_UID)
    const ref = doc(db, `users/${OWNER_UID}/ledgers/ledger-1/days/2026-08-10`)
    await assertFails(getDoc(ref))
    await assertFails(deleteDoc(ref))
    await assertFails(setDoc(ref, { state: 'did', updatedAt: serverTimestamp() }))
  })

  it('unauthenticated user cannot read or write a day within a ledger', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    await seedLedgerDayDoc(OWNER_UID, 'ledger-1', '2026-08-10', { state: 'did' })
    const db = dbAs(null)
    const ref = doc(db, `users/${OWNER_UID}/ledgers/ledger-1/days/2026-08-10`)
    await assertFails(getDoc(ref))
    await assertFails(setDoc(ref, { state: 'did', updatedAt: serverTimestamp() }))
  })

  it('rejects an invalid state, a malformed day id, and an unrecognized field', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1/days/2026-08-10`), {
        state: 'maybe',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1/days/not-a-date`), {
        state: 'did',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1/days/2026-08-10`), {
        state: 'did',
        tag: 'not supported',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a document with only updatedAt and no explicit field', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1/days/2026-08-10`), {
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('allows a valid note alongside a state override', async () => {
    await seedLedger(OWNER_UID, 'ledger-1')
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1/days/2026-08-10`), {
        state: 'didnt',
        note: 'Sick',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it("a count's validity resolves against this ledger's own default state, not the legacy tracker", async () => {
    await seedLedger(OWNER_UID, 'ledger-1', { ...validLedger, defaultState: 'did' })
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1/days/2026-08-10`), {
        count: 3,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a count when this ledger\'s own default state makes the day effectively didnt', async () => {
    await seedLedger(OWNER_UID, 'ledger-1', { ...validLedger, defaultState: 'didnt' })
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1/days/2026-08-10`), {
        count: 2,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a count on an explicit didnt day even when the ledger default is did', async () => {
    await seedLedger(OWNER_UID, 'ledger-1', { ...validLedger, defaultState: 'did' })
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1/days/2026-08-10`), {
        state: 'didnt',
        count: 2,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('keeps the two ledgers\' days completely independent', async () => {
    await seedLedger(OWNER_UID, 'ledger-1', { ...validLedger, defaultState: 'did' })
    await seedLedger(OWNER_UID, 'ledger-2', { ...validLedger, defaultState: 'didnt' })
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-1/days/2026-08-10`), {
        state: 'didnt',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(getDoc(doc(db, `users/${OWNER_UID}/ledgers/ledger-2/days/2026-08-10`)))
  })
})

describe('settings/app', () => {
  it('authenticated owner can set the active ledger', async () => {
    const db = dbAs(OWNER_UID)
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/settings/app`), {
        activeLedgerId: 'ledger-1',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('owner can read and overwrite the selection', async () => {
    const db = dbAs(OWNER_UID)
    await setDoc(doc(db, `users/${OWNER_UID}/settings/app`), {
      activeLedgerId: 'ledger-1',
      updatedAt: serverTimestamp(),
    })
    await assertSucceeds(getDoc(doc(db, `users/${OWNER_UID}/settings/app`)))
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}/settings/app`), {
        activeLedgerId: 'ledger-2',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('unauthenticated user cannot read or write the selection', async () => {
    const db = dbAs(null)
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}/settings/app`)))
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/settings/app`), {
        activeLedgerId: 'ledger-1',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('another authenticated user cannot read or write the selection', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/settings/app`), {
        activeLedgerId: 'ledger-1',
        updatedAt: new Date(),
      })
    })
    const db = dbAs(OTHER_UID)
    await assertFails(getDoc(doc(db, `users/${OWNER_UID}/settings/app`)))
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/settings/app`), {
        activeLedgerId: 'hijacked',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a non-string activeLedgerId', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/settings/app`), {
        activeLedgerId: 42,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects an empty activeLedgerId', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/settings/app`), {
        activeLedgerId: '',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects an unrecognized field', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/settings/app`), {
        activeLedgerId: 'ledger-1',
        extra: 'not allowed',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('owner can delete their own settings/app doc -- the last step of full account deletion', async () => {
    const db = dbAs(OWNER_UID)
    await setDoc(doc(db, `users/${OWNER_UID}/settings/app`), {
      activeLedgerId: 'ledger-1',
      updatedAt: serverTimestamp(),
    })
    await assertSucceeds(deleteDoc(doc(db, `users/${OWNER_UID}/settings/app`)))
  })

  it('another authenticated user cannot delete someone else\'s settings/app doc', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${OWNER_UID}/settings/app`), {
        activeLedgerId: 'ledger-1',
        updatedAt: new Date(),
      })
    })
    const db = dbAs(OTHER_UID)
    await assertFails(deleteDoc(doc(db, `users/${OWNER_UID}/settings/app`)))
  })

  it('unauthenticated user cannot delete a settings/app doc', async () => {
    const db = dbAs(null)
    await assertFails(deleteDoc(doc(db, `users/${OWNER_UID}/settings/app`)))
  })

  it('denies any document under settings/ other than app', async () => {
    const db = dbAs(OWNER_UID)
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}/settings/other`), {
        activeLedgerId: 'ledger-1',
        updatedAt: serverTimestamp(),
      }),
    )
  })
})
