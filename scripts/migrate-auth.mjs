#!/usr/bin/env node
// One-time Firebase Authentication migration utility: copies every user
// from the legacy Noted project to the dedicated Marked project, preserving
// exact UID and Google provider linkage. Companion to
// scripts/migrate-firestore.mjs -- see that file's header for the shared
// safety conventions this follows. Not general-purpose infrastructure: this
// only supports the exact case confirmed for this migration -- Google-only
// accounts, no password credentials involved anywhere.
//
// Usage:
//   node scripts/migrate-auth.mjs inventory
//   node scripts/migrate-auth.mjs migrate --confirm=MIGRATE-AUTH-NOTED-TO-MARKED
//   node scripts/migrate-auth.mjs verify
//
// Auth: Application Default Credentials on both ends, same as
// migrate-firestore.mjs. Deliberately never touches passwordHash/
// passwordSalt -- see assertGoogleOnly below, which refuses to run at all
// if any source user turns out to carry password credentials.

import process from 'node:process'
import { initializeApp, applicationDefault, deleteApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const SOURCE_PROJECT_ID = 'noted-app-c7d53'
const DESTINATION_PROJECT_ID = 'marked-app-733c0'

if (!SOURCE_PROJECT_ID || !DESTINATION_PROJECT_ID) {
  throw new Error('SOURCE_PROJECT_ID and DESTINATION_PROJECT_ID must both be set.')
}
if (SOURCE_PROJECT_ID === DESTINATION_PROJECT_ID) {
  throw new Error(
    `Refusing to run: source and destination resolve to the same project (${SOURCE_PROJECT_ID}).`,
  )
}

function initApp(projectId, name) {
  return initializeApp({ credential: applicationDefault(), projectId }, name)
}

async function listAllUsers(app) {
  const auth = getAuth(app)
  const users = []
  let pageToken
  do {
    const page = await auth.listUsers(1000, pageToken)
    users.push(...page.users)
    pageToken = page.pageToken
  } while (pageToken)
  return users
}

// Refuses rather than improvises: this migration's authorization is scoped
// exactly to "Google-only accounts, no password credentials" (confirmed
// manually against noted-app-c7d53's 4 users before this script was
// authorized to run). A user outside that shape needs a human decision, not
// a silently-guessed import strategy.
function assertGoogleOnlyNoPasswordCredential(userRecord) {
  const providerIds = userRecord.providerData.map((p) => p.providerId)
  if (providerIds.length !== 1 || providerIds[0] !== 'google.com') {
    throw new Error(
      `Refusing to import ${userRecord.uid}: expected exactly one 'google.com' provider, found [${providerIds.join(', ') || 'none'}]. ` +
        'This script does not improvise on provider/UID preservation -- stopping for a human decision.',
    )
  }
  // UserRecord only exposes these when the caller's credentials can read them;
  // this check exists purely as a refusal trigger, never a value we act on.
  if (userRecord.passwordHash || userRecord.passwordSalt) {
    throw new Error(
      `Refusing to import ${userRecord.uid}: a password credential is present. ` +
        'This migration is authorized for Google-only accounts only.',
    )
  }
}

function toImportRecord(userRecord) {
  const record = {
    uid: userRecord.uid,
    disabled: userRecord.disabled,
    providerData: userRecord.providerData.map((p) => ({
      uid: p.uid,
      providerId: p.providerId,
      ...(p.email ? { email: p.email } : {}),
      ...(p.displayName ? { displayName: p.displayName } : {}),
      ...(p.photoURL ? { photoURL: p.photoURL } : {}),
    })),
  }
  if (userRecord.email) record.email = userRecord.email
  if (userRecord.emailVerified !== undefined) record.emailVerified = userRecord.emailVerified
  if (userRecord.displayName) record.displayName = userRecord.displayName
  if (userRecord.photoURL) record.photoURL = userRecord.photoURL
  if (userRecord.metadata) {
    record.metadata = {
      ...(userRecord.metadata.creationTime ? { creationTime: userRecord.metadata.creationTime } : {}),
      ...(userRecord.metadata.lastSignInTime ? { lastSignInTime: userRecord.metadata.lastSignInTime } : {}),
      ...(userRecord.metadata.lastRefreshTime ? { lastRefreshTime: userRecord.metadata.lastRefreshTime } : {}),
    }
  }
  return record
}

// Only ever prints uid + non-content metadata needed to verify the
// migration -- never email, displayName, or photoURL. See CLAUDE.md's
// Privacy section and this migration's "log identity metadata only as
// needed for verification" constraint.
function printUserSummary(label, users) {
  console.log(`\n${label} (${users.length} user(s)):`)
  for (const user of users) {
    const providerIds = user.providerData.map((p) => p.providerId).join(',')
    console.log(
      `  uid=${user.uid} providers=[${providerIds}] emailVerified=${user.emailVerified} disabled=${user.disabled}`,
    )
  }
}

function uidSet(users) {
  return new Set(users.map((u) => u.uid))
}

function setsEqual(a, b) {
  return a.size === b.size && [...a].every((value) => b.has(value))
}

async function runInventory(sourceApp, destinationApp) {
  const sourceUsers = await listAllUsers(sourceApp)
  printUserSummary(`Source (${SOURCE_PROJECT_ID}) users`, sourceUsers)

  const destinationUsers = await listAllUsers(destinationApp)
  console.log(`\nDestination (${DESTINATION_PROJECT_ID}) user count: ${destinationUsers.length}`)
  if (destinationUsers.length > 0) {
    console.log('  Refusing any future migrate run until this is investigated.')
  }
}

function verifyMigration(sourceUsers, destinationUsers) {
  const results = { ok: true, problems: [] }

  if (destinationUsers.length !== sourceUsers.length) {
    results.ok = false
    results.problems.push(
      `destination has ${destinationUsers.length} user(s), expected ${sourceUsers.length}`,
    )
  }

  const sourceUids = uidSet(sourceUsers)
  const destinationUids = uidSet(destinationUsers)
  if (!setsEqual(sourceUids, destinationUids)) {
    results.ok = false
    const missing = [...sourceUids].filter((uid) => !destinationUids.has(uid))
    const extra = [...destinationUids].filter((uid) => !sourceUids.has(uid))
    if (missing.length > 0) results.problems.push(`missing in destination: ${missing.join(', ')}`)
    if (extra.length > 0) results.problems.push(`extra in destination: ${extra.join(', ')}`)
  }

  for (const user of destinationUsers) {
    const providerIds = user.providerData.map((p) => p.providerId)
    if (!providerIds.includes('google.com')) {
      results.ok = false
      results.problems.push(`${user.uid} lost its Google provider (has [${providerIds.join(', ')}])`)
    }
  }

  return results
}

const CONFIRM_PHRASE = 'MIGRATE-AUTH-NOTED-TO-MARKED'

async function runMigrate(sourceApp, destinationApp, confirmArg) {
  if (confirmArg !== CONFIRM_PHRASE) {
    throw new Error(`Refusing to run: pass --confirm=${CONFIRM_PHRASE} to acknowledge this performs real writes.`)
  }

  const existingDestinationUsers = await listAllUsers(destinationApp)
  if (existingDestinationUsers.length > 0) {
    throw new Error(
      `Refusing to run: ${DESTINATION_PROJECT_ID} Auth already has ${existingDestinationUsers.length} user(s). ` +
        'This tool only supports a single first-write pass.',
    )
  }

  const sourceUsers = await listAllUsers(sourceApp)
  for (const user of sourceUsers) assertGoogleOnlyNoPasswordCredential(user)

  console.log(`Importing ${sourceUsers.length} user(s) from ${SOURCE_PROJECT_ID} to ${DESTINATION_PROJECT_ID}...`)
  const auth = getAuth(destinationApp)
  // No `hash` option: every source user is Google-only, so importUsers has
  // no password credential to encode -- see assertGoogleOnlyNoPasswordCredential.
  const importResult = await auth.importUsers(sourceUsers.map(toImportRecord))

  if (importResult.failureCount > 0) {
    for (const failure of importResult.errors) {
      console.error(`  import failure at index ${failure.index}: ${failure.error.message}`)
    }
    throw new Error(`Refusing to continue: ${importResult.failureCount} user(s) failed to import.`)
  }
  console.log(`  imported ${importResult.successCount} user(s), 0 failures`)

  const destinationUsers = await listAllUsers(destinationApp)
  const verification = verifyMigration(sourceUsers, destinationUsers)
  printUserSummary('Destination users after import', destinationUsers)

  console.log(`\nVerification: ${verification.ok ? 'PASSED' : 'FAILED'}`)
  if (!verification.ok) {
    for (const problem of verification.problems) console.log(`  - ${problem}`)
    throw new Error('Auth migration verification failed -- see problems above. Do not proceed to Firestore migration.')
  }
}

async function runVerify(sourceApp, destinationApp) {
  const sourceUsers = await listAllUsers(sourceApp)
  const destinationUsers = await listAllUsers(destinationApp)
  const verification = verifyMigration(sourceUsers, destinationUsers)

  printUserSummary(`Source (${SOURCE_PROJECT_ID}) users`, sourceUsers)
  printUserSummary(`Destination (${DESTINATION_PROJECT_ID}) users`, destinationUsers)

  console.log(`\nVerification: ${verification.ok ? 'PASSED' : 'FAILED'}`)
  if (!verification.ok) {
    for (const problem of verification.problems) console.log(`  - ${problem}`)
  }
  return verification.ok
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2)
  const flags = Object.fromEntries(
    rest
      .filter((arg) => arg.startsWith('--'))
      .map((arg) => {
        const [key, ...valueParts] = arg.slice(2).split('=')
        return [key, valueParts.join('=') || true]
      }),
  )

  if (!['inventory', 'migrate', 'verify'].includes(mode)) {
    console.error('Usage: node scripts/migrate-auth.mjs <inventory|migrate|verify> [--flags]')
    process.exitCode = 1
    return
  }

  console.log(`Mode: ${mode}`)
  console.log(`Configured source:      ${SOURCE_PROJECT_ID}`)
  console.log(`Configured destination: ${DESTINATION_PROJECT_ID}`)

  const sourceApp = initApp(SOURCE_PROJECT_ID, 'auth-source')
  const destinationApp = initApp(DESTINATION_PROJECT_ID, 'auth-destination')

  try {
    if (mode === 'inventory') await runInventory(sourceApp, destinationApp)
    else if (mode === 'migrate') await runMigrate(sourceApp, destinationApp, flags.confirm)
    else if (mode === 'verify') await runVerify(sourceApp, destinationApp)
  } finally {
    await Promise.all([sourceApp, destinationApp].map((app) => deleteApp(app)))
  }
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
})
