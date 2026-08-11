import type { DayState } from './tracker'

export interface DailyRecord {
  state?: DayState
  note?: string
  count?: number
}

export const NOTE_MAX_LENGTH = 120
export const COUNT_MIN = 1
export const COUNT_MAX = 99
export const COUNT_OTHER_MIN = 4

export interface DailyRecordInput {
  defaultState: DayState
  effectiveState: DayState
  note?: string
  count?: number
}

export type NormalizedDailyRecord =
  | { kind: 'delete' }
  | { kind: 'set'; state?: DayState; note?: string; count?: number }

/**
 * Determines the minimal persisted form of a daily record. A field is
 * included only when it differs from what would otherwise be derived
 * (tracker default state, no note, implicit single occurrence).
 */
export function normalizeDailyRecord(input: DailyRecordInput): NormalizedDailyRecord {
  const state = input.effectiveState === input.defaultState ? undefined : input.effectiveState
  const note = normalizeNote(input.note)
  const count = input.effectiveState === 'did' ? normalizeCount(input.count) : undefined

  if (state === undefined && note === undefined && count === undefined) {
    return { kind: 'delete' }
  }

  const record: NormalizedDailyRecord = { kind: 'set' }
  if (state !== undefined) record.state = state
  if (note !== undefined) record.note = note
  if (count !== undefined) record.count = count
  return record
}

function normalizeNote(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeCount(raw: number | undefined): number | undefined {
  if (raw === undefined) return undefined
  if (!Number.isInteger(raw) || raw <= 1) return undefined
  return raw
}

export type NoteValidation =
  | { valid: true; note: string | undefined }
  | { valid: false; error: string }

export function validateNote(input: string): NoteValidation {
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return { valid: true, note: undefined }
  }
  if (trimmed.length > NOTE_MAX_LENGTH) {
    return { valid: false, error: `Keep it under ${NOTE_MAX_LENGTH} characters.` }
  }
  return { valid: true, note: trimmed }
}

export type CountValidation =
  | { valid: true; count: number | undefined }
  | { valid: false; error: string }

export function validateCount(input: string): CountValidation {
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return { valid: true, count: undefined }
  }
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed)) {
    return { valid: false, error: 'Enter a whole number.' }
  }
  if (parsed < COUNT_MIN || parsed > COUNT_MAX) {
    return { valid: false, error: `Enter a number from ${COUNT_MIN} to ${COUNT_MAX}.` }
  }
  if (parsed <= 1) {
    return { valid: true, count: undefined }
  }
  return { valid: true, count: parsed }
}

export function formatCount(count: number): string {
  return `${count}×`
}

/** Which quick-count option a stored count value corresponds to. */
export type CountMode = 'none' | 'two' | 'three' | 'other'

export function modeForCount(count: number | undefined): CountMode {
  if (count === 2) return 'two'
  if (count === 3) return 'three'
  if (count === undefined) return 'none'
  return 'other'
}

/**
 * Validates the free-entry "Other" count field. The 2x/3x quick options
 * cover the common cases, so this path only ever needs to accept whole
 * numbers strictly above that dedicated range.
 */
export function validateOtherCount(input: string): CountValidation {
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return { valid: false, error: 'Enter a number.' }
  }
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed)) {
    return { valid: false, error: 'Enter a whole number.' }
  }
  if (parsed < COUNT_OTHER_MIN || parsed > COUNT_MAX) {
    return { valid: false, error: `Enter a number ${COUNT_OTHER_MIN} or greater.` }
  }
  return { valid: true, count: parsed }
}
