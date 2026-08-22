#!/usr/bin/env node
// One-time Firestore migration utility: copies every user's Marked. data
// from the legacy Noted Firebase project to the dedicated Marked project,
// preserving exact document paths/ids and Firestore-native field types
// (Timestamp included). This is a focused, single-purpose tool for this one
// migration -- not a general-purpose data-sync framework. See CLAUDE.md's
// Migration Status section for the project context.
//
// Usage (all modes are safe to run repeatedly except `migrate`):
//   node scripts/migrate-firestore.mjs inventory
//   node scripts/migrate-firestore.mjs dry-run
//   node scripts/migrate-firestore.mjs verify --manifest=.migration/<file>.json
//   node scripts/migrate-firestore.mjs migrate --confirm=MIGRATE-NOTED-TO-MARKED
//
// Auth: uses Application Default Credentials (ADC) on both ends -- the
// operator's own Google account, already granted access to both Firebase
// projects, not a service-account key. Set these up locally with:
//   gcloud auth application-default login
// No credential material is read, printed, or written by this script itself.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { initializeApp, applicationDefault, deleteApp } from 'firebase-admin/app'
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore'

// -- Non-negotiable project identity guards ---------------------------------
// These are deliberately hardcoded, not read from .env or .firebaserc, so
// this script's source of truth for "which two projects" can never silently
// drift with unrelated local config changes. Every mode re-checks these
// before touching either project.
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

// Every daily-entry doc lives in a collection literally named "days" --
// collectionGroup('days') therefore returns both the legacy
// users/{uid}/days/{dayId} docs and every users/{uid}/ledgers/{id}/days/{dayId}
// doc in one query; category() below tells them apart by path shape.
const COLLECTION_GROUPS = ['tracker', 'days', 'ledgers', 'settings']

const BATCH_SIZE = 400 // Firestore's hard cap is 500 writes per batch.
const MANIFEST_DIR = path.resolve(import.meta.dirname, '..', '.migration')

// -- Path categorization ------------------------------------------------
// Every document this app writes falls into exactly one of these five
// shapes (see firestore.rules and src/data/*.ts). Anything else indicates
// either a bug in this script's assumptions or unexpected data, and is
// surfaced rather than silently copied.
function categorize(docPath) {
  const segments = docPath.split('/')
  // users/{uid}/tracker/config
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'tracker') {
    return 'trackerConfig'
  }
  // users/{uid}/days/{dayId}
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'days') {
    return 'legacyDay'
  }
  // users/{uid}/ledgers/{ledgerId}
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'ledgers') {
    return 'ledger'
  }
  // users/{uid}/ledgers/{ledgerId}/days/{dayId}
  if (segments.length === 6 && segments[0] === 'users' && segments[2] === 'ledgers' && segments[4] === 'days') {
    return 'ledgerDay'
  }
  // users/{uid}/settings/app
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'settings') {
    return 'settingsApp'
  }
  return 'unexpected'
}

function uidOf(docPath) {
  return docPath.split('/')[1]
}

// -- Native-type-preserving stable hash --------------------------------
// Used only for the manifest (a parity-proof artifact), never for the
// actual copy -- the copy always writes snapshot.data() directly so
// Timestamp/string/number/boolean/map values pass through unchanged. This
// serializer exists so two Timestamp instances with the same
// seconds/nanoseconds hash identically regardless of key order.
function stableValue(value) {
  if (value instanceof Timestamp) {
    return { __type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds }
  }
  if (value instanceof GeoPoint) {
    return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude }
  }
  if (value instanceof DocumentReference) {
    return { __type: 'reference', path: value.path }
  }
  if (Array.isArray(value)) {
    return value.map(stableValue)
  }
  if (value !== null && typeof value === 'object') {
    const sortedKeys = Object.keys(value).sort()
    const out = {}
    for (const key of sortedKeys) out[key] = stableValue(value[key])
    return out
  }
  return value // string, number, boolean, null
}

function hashDoc(data) {
  return createHash('sha256').update(JSON.stringify(stableValue(data))).digest('hex')
}

// Runs unconditionally before every mode: proves hashDoc compares Firestore
// documents by actual value, not incidental object shape -- key insertion
// order must not matter, and Timestamp equality must be exact-value
// (seconds + nanoseconds), not reference identity or default toString/JSON
// formatting. A manifest built on a hash that fails either property could
// either miss a real content difference or flag two identical documents as
// mismatched.
function selfTestHashing() {
  const a = { b: 1, a: new Timestamp(1700000000, 500), nested: { y: 2, x: 1 } }
  const b = { nested: { x: 1, y: 2 }, a: new Timestamp(1700000000, 500), b: 1 }
  if (hashDoc(a) !== hashDoc(b)) {
    throw new Error(
      'Hashing self-test failed: two documents with the same values in different key order hashed differently.',
    )
  }

  const sameSecondsDifferentNanos = { a: new Timestamp(1700000000, 500) }
  const baseline = { a: new Timestamp(1700000000, 501) }
  if (hashDoc(sameSecondsDifferentNanos) === hashDoc(baseline)) {
    throw new Error('Hashing self-test failed: Timestamps differing only in nanoseconds hashed identically.')
  }

  const differentSeconds = { a: new Timestamp(1700000001, 500) }
  const sameNanosOriginal = { a: new Timestamp(1700000000, 500) }
  if (hashDoc(differentSeconds) === hashDoc(sameNanosOriginal)) {
    throw new Error('Hashing self-test failed: Timestamps differing only in seconds hashed identically.')
  }

  const distinctInstancesSameValue = { a: new Timestamp(1700000000, 500) }
  if (hashDoc(sameNanosOriginal) !== hashDoc(distinctInstancesSameValue)) {
    throw new Error(
      'Hashing self-test failed: two distinct Timestamp instances holding the same value hashed differently.',
    )
  }

  console.log('Hashing self-test passed: canonical key order and exact Timestamp-value comparison confirmed.')
}

// Every field type actually present in this app's schema, per
// src/data/*.ts and firestore.rules -- anything outside this set on a real
// document is flagged, not silently assumed safe to copy verbatim.
function unexpectedFieldTypes(data) {
  const offenders = []
  function walk(value, keyPath) {
    if (value instanceof Timestamp) return
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return
    if (value === null) {
      offenders.push(`${keyPath} (null)`)
      return
    }
    if (Array.isArray(value)) {
      offenders.push(`${keyPath} (array)`)
      return
    }
    if (value instanceof GeoPoint) {
      offenders.push(`${keyPath} (GeoPoint)`)
      return
    }
    if (value instanceof DocumentReference) {
      offenders.push(`${keyPath} (DocumentReference)`)
      return
    }
    if (typeof value === 'object') {
      for (const [key, nested] of Object.entries(value)) walk(nested, `${keyPath}.${key}`)
      return
    }
    offenders.push(`${keyPath} (${typeof value})`)
  }
  for (const [key, value] of Object.entries(data)) walk(value, key)
  return offenders
}

// -- App initialization --------------------------------------------------
function initApp(projectId, name) {
  return initializeApp({ credential: applicationDefault(), projectId }, name)
}

async function fetchAllDocs(app) {
  const db = getFirestore(app)
  const results = []
  for (const groupId of COLLECTION_GROUPS) {
    const snapshot = await db.collectionGroup(groupId).get()
    for (const docSnapshot of snapshot.docs) {
      results.push({ path: docSnapshot.ref.path, ref: docSnapshot.ref, data: docSnapshot.data() })
    }
  }
  return results
}

// Proves the source inventory is exhaustive rather than a query over an
// assumed schema. collectionGroup(id) already searches the *entire*
// database for every collection literally named 'tracker'/'days'/
// 'ledgers'/'settings' regardless of where it's nested, so COLLECTION_GROUPS
// alone already can't miss a document under one of those four names. What
// it structurally cannot detect is a collection under a *different* name --
// so this walks the actual discovered structure with listCollections()
// (which enumerates real collection ids, not assumed ones) at every level
// this app's schema has: the database root, each known user, and each known
// ledger. Bounded by what's actually discovered, not the schema's own
// expectations of itself.
async function verifyExhaustiveTopology(app, sourceDocs) {
  const db = getFirestore(app)
  const anomalies = []

  const rootCollections = await db.listCollections()
  const rootIds = rootCollections.map((c) => c.id)
  for (const id of rootIds) {
    if (id !== 'users') anomalies.push(`unexpected top-level collection: ${id}`)
  }

  const uids = new Set(sourceDocs.map((doc) => uidOf(doc.path)))
  const ledgerPaths = sourceDocs.filter((doc) => categorize(doc.path) === 'ledger').map((doc) => doc.path)

  for (const uid of uids) {
    const userDocRef = db.doc(`users/${uid}`)
    const userDocSnapshot = await userDocRef.get()
    if (userDocSnapshot.exists) {
      anomalies.push(`unexpected document directly at users/${uid} (this app never writes one)`)
    }
    const subcollections = await userDocRef.listCollections()
    for (const collectionRef of subcollections) {
      if (!['tracker', 'days', 'ledgers', 'settings'].includes(collectionRef.id)) {
        anomalies.push(`unexpected subcollection users/${uid}/${collectionRef.id}`)
      }
    }
  }

  for (const ledgerPath of ledgerPaths) {
    const subcollections = await db.doc(ledgerPath).listCollections()
    for (const collectionRef of subcollections) {
      if (collectionRef.id !== 'days') {
        anomalies.push(`unexpected subcollection ${ledgerPath}/${collectionRef.id}`)
      }
    }
  }

  return { anomalies, rootCollectionIds: rootIds, usersInspected: uids.size, ledgersInspected: ledgerPaths.length }
}

function printTopologyCheck(result) {
  console.log(`\nExhaustive topology check:`)
  console.log(`  root collections:     [${result.rootCollectionIds.join(', ')}]`)
  console.log(`  users inspected:      ${result.usersInspected}`)
  console.log(`  ledgers inspected:    ${result.ledgersInspected}`)
  if (result.anomalies.length === 0) {
    console.log('  no unexpected collections, subcollections, or orphaned paths found.')
  } else {
    console.log(`  ⚠ ${result.anomalies.length} anomaly(ies) found:`)
    for (const anomaly of result.anomalies) console.log(`    ${anomaly}`)
  }
}

async function destinationIsEmpty(app) {
  const db = getFirestore(app)
  for (const groupId of COLLECTION_GROUPS) {
    const snapshot = await db.collectionGroup(groupId).limit(1).get()
    if (!snapshot.empty) return false
  }
  return true
}

function summarize(docs) {
  const byCategory = {}
  const uids = new Set()
  const unexpectedByPath = {}
  for (const { path: docPath, data } of docs) {
    const category = categorize(docPath)
    byCategory[category] = (byCategory[category] ?? 0) + 1
    uids.add(uidOf(docPath))
    const offenders = unexpectedFieldTypes(data)
    if (offenders.length > 0) unexpectedByPath[docPath] = offenders
  }
  return { total: docs.length, byCategory, distinctUids: uids.size, unexpectedByPath }
}

function printSummary(label, summary) {
  console.log(`\n${label}`)
  console.log(`  total documents:    ${summary.total}`)
  console.log(`  distinct users:     ${summary.distinctUids}`)
  for (const category of ['trackerConfig', 'legacyDay', 'ledger', 'ledgerDay', 'settingsApp', 'unexpected']) {
    if (summary.byCategory[category] !== undefined) {
      console.log(`  ${category.padEnd(18)}${summary.byCategory[category]}`)
    }
  }
  const unexpectedCount = Object.keys(summary.unexpectedByPath).length
  if (unexpectedCount > 0) {
    console.log(`  ⚠ ${unexpectedCount} document(s) contain field types outside the known schema:`)
    for (const [docPath, offenders] of Object.entries(summary.unexpectedByPath)) {
      console.log(`    ${docPath}: ${offenders.join(', ')}`)
    }
  }
}

async function writeManifest(mode, sourceDocs) {
  await mkdir(MANIFEST_DIR, { recursive: true })
  const manifest = {
    sourceProject: SOURCE_PROJECT_ID,
    destinationProject: DESTINATION_PROJECT_ID,
    mode,
    generatedAt: new Date().toISOString(),
    totalDocuments: sourceDocs.length,
    // Content is hashed, never stored raw -- these paths carry private
    // per-user data (note text, ledger/tracker names) that has no reason
    // to sit in a plaintext file. See CLAUDE.md's Privacy section.
    documents: sourceDocs
      .map(({ path: docPath, data }) => ({
        path: docPath,
        category: categorize(docPath),
        sha256: hashDoc(data),
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  }
  const filename = `manifest-${mode}-${manifest.generatedAt.replace(/[:.]/g, '-')}.json`
  const filePath = path.join(MANIFEST_DIR, filename)
  await writeFile(filePath, JSON.stringify(manifest, null, 2))
  return filePath
}

// -- Modes -----------------------------------------------------------------

async function runInventory(sourceApp, destinationApp) {
  console.log(`Source:      ${SOURCE_PROJECT_ID} (read-only)`)
  console.log(`Destination: ${DESTINATION_PROJECT_ID} (empty-check only)`)

  const sourceDocs = await fetchAllDocs(sourceApp)
  printSummary('Source inventory (noted-app-c7d53):', summarize(sourceDocs))
  printTopologyCheck(await verifyExhaustiveTopology(sourceApp, sourceDocs))

  const empty = await destinationIsEmpty(destinationApp)
  console.log(`\nDestination empty (${DESTINATION_PROJECT_ID}): ${empty ? 'YES' : 'NO -- contains data'}`)
  if (!empty) {
    console.log('  Refusing any future migrate run until this is investigated.')
  }
}

async function runDryRun(sourceApp, destinationApp) {
  console.log(`Source:      ${SOURCE_PROJECT_ID} (read-only)`)
  console.log(`Destination: ${DESTINATION_PROJECT_ID} (empty-check only, no writes)`)

  const sourceDocs = await fetchAllDocs(sourceApp)
  const summary = summarize(sourceDocs)
  printSummary('Dry-run: what a real migrate would copy from noted-app-c7d53:', summary)
  printTopologyCheck(await verifyExhaustiveTopology(sourceApp, sourceDocs))

  const empty = await destinationIsEmpty(destinationApp)
  console.log(`\nDestination empty (${DESTINATION_PROJECT_ID}): ${empty ? 'YES' : 'NO -- contains data'}`)

  const manifestPath = await writeManifest('dry-run', sourceDocs)
  console.log(`\nManifest written (paths + content hashes only, no field values): ${manifestPath}`)
  console.log('No writes were made to either project.')
}

async function runVerify(destinationApp, manifestArg) {
  if (!manifestArg) {
    throw new Error('verify requires --manifest=<path to a manifest json produced by dry-run or migrate>')
  }
  const manifest = JSON.parse(await readFile(manifestArg, 'utf8'))
  if (manifest.sourceProject !== SOURCE_PROJECT_ID || manifest.destinationProject !== DESTINATION_PROJECT_ID) {
    throw new Error('Manifest project ids do not match this script\'s configured source/destination.')
  }

  const destDocs = await fetchAllDocs(destinationApp)
  const destByPath = new Map(destDocs.map((doc) => [doc.path, doc]))
  const manifestPaths = new Set(manifest.documents.map((entry) => entry.path))

  let matched = 0
  const missing = []
  const mismatched = []
  for (const entry of manifest.documents) {
    const destDoc = destByPath.get(entry.path)
    if (!destDoc) {
      missing.push(entry.path)
      continue
    }
    const destHash = hashDoc(destDoc.data)
    if (destHash !== entry.sha256) {
      mismatched.push(entry.path)
      continue
    }
    matched++
  }
  const extra = destDocs.map((doc) => doc.path).filter((docPath) => !manifestPaths.has(docPath))

  console.log(`\nVerify against manifest: ${manifestArg}`)
  console.log(`  manifest documents:  ${manifest.documents.length}`)
  console.log(`  matched:             ${matched}`)
  console.log(`  missing in dest:     ${missing.length}`)
  console.log(`  content mismatches:  ${mismatched.length}`)
  console.log(`  extra in dest:       ${extra.length}`)
  if (missing.length > 0) console.log(`  missing paths:\n    ${missing.join('\n    ')}`)
  if (mismatched.length > 0) console.log(`  mismatched paths:\n    ${mismatched.join('\n    ')}`)
  if (extra.length > 0) console.log(`  extra paths:\n    ${extra.join('\n    ')}`)

  const parity = missing.length === 0 && mismatched.length === 0 && extra.length === 0
  console.log(`\nParity: ${parity ? 'CONFIRMED' : 'NOT CONFIRMED -- see above'}`)
  return parity
}

const CONFIRM_PHRASE = 'MIGRATE-NOTED-TO-MARKED'

async function runMigrate(sourceApp, destinationApp, confirmArg) {
  if (confirmArg !== CONFIRM_PHRASE) {
    throw new Error(`Refusing to run: pass --confirm=${CONFIRM_PHRASE} to acknowledge this performs real writes.`)
  }

  const empty = await destinationIsEmpty(destinationApp)
  if (!empty) {
    throw new Error(
      `Refusing to run: ${DESTINATION_PROJECT_ID} is not empty. This tool only supports a single first-write pass; ` +
        'partial/duplicate state must be investigated manually before any rerun.',
    )
  }

  const sourceDocs = await fetchAllDocs(sourceApp)

  const topology = await verifyExhaustiveTopology(sourceApp, sourceDocs)
  printTopologyCheck(topology)
  if (topology.anomalies.length > 0) {
    throw new Error(
      'Refusing to run: exhaustive topology check found anomalies outside the known schema -- see above. ' +
        'Investigate before migrating.',
    )
  }

  console.log(`Copying ${sourceDocs.length} documents from ${SOURCE_PROJECT_ID} to ${DESTINATION_PROJECT_ID}...`)

  const destDb = getFirestore(destinationApp)
  for (let index = 0; index < sourceDocs.length; index += BATCH_SIZE) {
    const chunk = sourceDocs.slice(index, index + BATCH_SIZE)
    const batch = destDb.batch()
    for (const { path: docPath, data } of chunk) {
      // .data() straight into .set(): no JSON round-trip, so Timestamp,
      // string, number, and map values pass through exactly as stored on
      // the source document -- see stableValue's comment for why the
      // manifest hash instead uses a JSON-safe projection of the same data.
      batch.set(destDb.doc(docPath), data)
    }
    await batch.commit()
    console.log(`  committed ${Math.min(index + BATCH_SIZE, sourceDocs.length)}/${sourceDocs.length}`)
  }

  const manifestPath = await writeManifest('migrate', sourceDocs)
  console.log(`\nMigration complete. Manifest for verification: ${manifestPath}`)
  console.log('Run `verify` against this manifest before treating the migration as trustworthy.')
}

// -- Entry point -------------------------------------------------------
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

  if (!['inventory', 'dry-run', 'verify', 'migrate'].includes(mode)) {
    console.error('Usage: node scripts/migrate-firestore.mjs <inventory|dry-run|verify|migrate> [--flags]')
    process.exitCode = 1
    return
  }

  selfTestHashing()

  console.log(`Mode: ${mode}`)
  console.log(`Configured source:      ${SOURCE_PROJECT_ID}`)
  console.log(`Configured destination: ${DESTINATION_PROJECT_ID}`)

  const sourceApp = mode === 'verify' ? null : initApp(SOURCE_PROJECT_ID, 'source')
  const destinationApp = initApp(DESTINATION_PROJECT_ID, 'destination')

  try {
    if (mode === 'inventory') await runInventory(sourceApp, destinationApp)
    else if (mode === 'dry-run') await runDryRun(sourceApp, destinationApp)
    else if (mode === 'verify') await runVerify(destinationApp, flags.manifest)
    else if (mode === 'migrate') await runMigrate(sourceApp, destinationApp, flags.confirm)
  } finally {
    await Promise.all([sourceApp, destinationApp].filter(Boolean).map((app) => deleteApp(app)))
  }
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
})
