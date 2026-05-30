import { google } from 'googleapis'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'
import { localToUTC, SALON_TIMEZONE } from '../lib/timezone.js'

function getOAuth2Client() {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      'Google Calendar credentials not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in .env'
    )
  }
  const auth = new google.auth.OAuth2(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET)
  auth.setCredentials({ refresh_token: config.GOOGLE_REFRESH_TOKEN })
  return auth
}

export interface BusySlot {
  start: string
  end: string
}

export async function getFreeBusy(calendarId: string, date: string): Promise<BusySlot[]> {
  try {
    const auth = getOAuth2Client()
    const calendar = google.calendar({ version: 'v3', auth })

    const timeMin = `${date}T00:00:00Z`
    const timeMax = `${date}T23:59:59Z`

    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: calendarId }],
      },
    })

    const busy = res.data.calendars?.[calendarId]?.busy || []
    logger.debug({ calendarId, date, busyCount: busy.length }, 'FreeBusy fetched')

    return busy.map(slot => ({
      start: slot.start || '',
      end: slot.end || '',
    }))
  } catch (err) {
    logger.error({ calendarId, date, err }, 'FreeBusy failed')
    return []
  }
}

export async function createCalendarEvent(
  calendarId: string,
  title: string,
  date: string,
  startTime: string,
  durationMin: number
): Promise<string | null> {
  try {
    const auth = getOAuth2Client()
    const calendar = google.calendar({ version: 'v3', auth })

    const [hStr, mStr] = startTime.split(':')
    const startDateTime = localToUTC(date, parseInt(hStr), parseInt(mStr), SALON_TIMEZONE)
    const endDateTime = new Date(startDateTime.getTime() + durationMin * 60 * 1000)

    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: title,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'Europe/Warsaw',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'Europe/Warsaw',
        },
      },
    })

    logger.info({ calendarId, title, date, startTime, eventId: res.data.id }, 'Calendar event created')
    return res.data.id || null
  } catch (err) {
    logger.error({ calendarId, title, date, startTime, err }, 'Failed to create calendar event')
    return null
  }
}
