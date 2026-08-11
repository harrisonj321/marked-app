import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

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

  it('rejects changing defaultState on update', async () => {
    await seedTracker(OWNER_UID)
    const db = dbAs(OWNER_UID)
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
