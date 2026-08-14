export function getLocalDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

export function getTodayKey(timeZone: string): string {
  return getLocalDateKey(new Date(), timeZone)
}

/** The device's current IANA timezone, used when creating a ledger (the first one, or any later one). */
export function resolveDeviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function formatDisplayDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-')
  return `${month}/${day}/${year}`
}

export function millisecondsUntilNextLocalMidnight(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const hours = Number(lookup.hour) % 24
  const minutes = Number(lookup.minute)
  const seconds = Number(lookup.second)

  const millisecondsSinceMidnight =
    hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + date.getMilliseconds()

  return 24 * 3_600_000 - millisecondsSinceMidnight
}
