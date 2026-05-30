/**
 * Converts a local (given timezone) date+time to a UTC Date object.
 * Uses Intl.DateTimeFormat to resolve the correct DST offset,
 * so comparisons with UTC-based Google Calendar busy slots are always accurate.
 */
export function localToUTC(date: string, hour: number, minute: number, timezone: string): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const candidate = new Date(Date.UTC(y, mo - 1, d, hour, minute, 0))

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(candidate)

  const get = (type: string): number =>
    parseInt(parts.find(p => p.type === type)!.value)

  const localAsUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second')
  )

  const offsetMs = candidate.getTime() - localAsUTC
  return new Date(candidate.getTime() + offsetMs)
}

export const SALON_TIMEZONE = 'Europe/Warsaw'
