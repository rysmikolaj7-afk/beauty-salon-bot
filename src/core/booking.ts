import { getFreeBusy } from '../integrations/googleCalendar.js'
import { findUsluga } from '../db/repos/uslugi.js'
import { findPracownikForUsluga } from '../db/repos/pracownicy.js'
import { logger } from '../lib/logger.js'
import { localToUTC, SALON_TIMEZONE } from '../lib/timezone.js'
import type { Salon } from '../db/airtable.js'

export interface BookingContext {
  salon: Salon
  serviceName: string
  preferredDay: string
  preferredTime?: string
  clientId: string
  conversationId: string
  subscriberId: string
}

export interface BookingResult {
  responseText: string
  availableSlots?: string[]
  calendarId?: string
  uslugaId?: string
  pracownikId?: string
}


export function generateFreeSlots(
  busySlots: Array<{ start: string; end: string }>,
  date: string,
  openHour: number,
  closeHour: number,
  durationMin: number
): string[] {
  const freeSlots: string[] = []
  const closeTime = localToUTC(date, closeHour, 0, SALON_TIMEZONE)

  for (let h = openHour; h < closeHour; h++) {
    for (const m of [0, 30]) {
      const slotStart = localToUTC(date, h, m, SALON_TIMEZONE)
      const slotEnd = new Date(slotStart.getTime() + durationMin * 60 * 1000)

      if (slotEnd > closeTime) continue

      const hasConflict = busySlots.some(busy => {
        const busyStart = new Date(busy.start)
        const busyEnd = new Date(busy.end)
        return slotStart < busyEnd && slotEnd > busyStart
      })

      if (!hasConflict) {
        freeSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      }
    }
  }

  return freeSlots
}

export function parseOpeningHours(godzinyOtwarcia: string): { open: number; close: number } {
  const match = godzinyOtwarcia.match(/(\d{1,2}):\d{2}\s*[-–]\s*(\d{1,2}):\d{2}/)
  if (match) {
    return { open: parseInt(match[1]), close: parseInt(match[2]) }
  }
  return { open: 9, close: 18 }
}

export interface ConfirmContext {
  salon: Salon
  serviceName: string
  preferredDay: string
  preferredTime: string
  clientId: string
  conversationId: string
  subscriberId: string
}

export async function processConfirm(ctx: ConfirmContext): Promise<BookingResult> {
  const { salon, serviceName, preferredDay, preferredTime, clientId } = ctx

  const usluga = await findUsluga(salon.Nazwa, serviceName)
  if (!usluga) {
    return {
      responseText: `Przepraszam, nie mogłam znaleźć usługi "${serviceName}". Proszę spróbować ponownie.`,
    }
  }

  const pracownik = await findPracownikForUsluga(salon.Nazwa, usluga.Nazwa)
  const calendarId = pracownik?.calendar_id || 'mikirys3333@gmail.com'

  const busySlots = await getFreeBusy(calendarId, preferredDay)
  const { open, close } = parseOpeningHours(salon.godziny_otwarcia)
  const freeSlots = generateFreeSlots(busySlots, preferredDay, open, close, usluga.czas_trwania_min)

  if (!freeSlots.includes(preferredTime)) {
    return {
      responseText: `Przepraszam, termin ${preferredTime} nie jest już dostępny. Proszę wybrać inny: ${freeSlots.slice(0, 3).join(', ')} lub podać inny dzień.`,
    }
  }

  const { createCalendarEvent } = await import('../integrations/googleCalendar.js')
  const eventId = await createCalendarEvent(
    calendarId,
    `${usluga.Nazwa} — ${salon.Nazwa}`,
    preferredDay,
    preferredTime,
    usluga.czas_trwania_min
  )

  if (!eventId) {
    return {
      responseText: 'Przepraszam, wystąpił problem z rezerwacją kalendarza. Proszę spróbować za chwilę lub skontaktować się bezpośrednio z salonem.',
    }
  }

  const { createRezerwacja } = await import('../db/repos/rezerwacje.js')
  await createRezerwacja({
    salonId: salon.id,
    klientId: clientId,
    pracownikId: pracownik?.id || '',
    uslugaId: usluga.id,
    dataWizyty: preferredDay,
    godzinaRozpoczecia: preferredTime,
    calendarEventId: eventId,
  })

  const pracownikInfo = pracownik ? ` z ${pracownik.Imie_Nazwisko}` : ''

  return {
    responseText: `Rezerwacja potwierdzona!\n\n${usluga.Nazwa}${pracownikInfo}\n${preferredDay} o godz. ${preferredTime}\n${usluga.cena} PLN\n\nDo zobaczenia w salonie!`,
    calendarId,
    uslugaId: usluga.id,
    pracownikId: pracownik?.id,
  }
}

export async function processBooking(ctx: BookingContext): Promise<BookingResult> {
  const { salon, serviceName, preferredDay } = ctx

  const usluga = await findUsluga(salon.Nazwa, serviceName)
  if (!usluga) {
    logger.warn({ serviceName, salon: salon.Nazwa }, 'Service not found')
    return {
      responseText: `Przepraszam, nie znalazłam usługi "${serviceName}" w naszej ofercie. Czy chodziło o inną usługę? Wpisz "jakie macie usługi" żeby zobaczyć pełną ofertę.`,
    }
  }

  const pracownik = await findPracownikForUsluga(salon.Nazwa, usluga.Nazwa)
  const calendarId = pracownik?.calendar_id || 'mikirys3333@gmail.com'

  // Reject past dates entirely
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: SALON_TIMEZONE }) // YYYY-MM-DD
  if (preferredDay < todayStr) {
    return {
      responseText: `Przepraszam, data ${preferredDay} jest już w przeszłości. Proszę podać dzień od dziś lub późniejszy. 📅`,
    }
  }

  const busySlots = await getFreeBusy(calendarId, preferredDay)

  const { open, close } = parseOpeningHours(salon.godziny_otwarcia)
  let freeSlots = generateFreeSlots(busySlots, preferredDay, open, close, usluga.czas_trwania_min)

  // If booking for today — filter out slots that are already past (+ 30 min buffer)
  if (preferredDay === todayStr) {
    const nowWarsaw = new Date(new Date().toLocaleString('en-US', { timeZone: SALON_TIMEZONE }))
    const nowMinutes = nowWarsaw.getHours() * 60 + nowWarsaw.getMinutes() + 30 // 30 min buffer
    freeSlots = freeSlots.filter(slot => {
      const [h, m] = slot.split(':').map(Number)
      return h * 60 + m > nowMinutes
    })
  }

  logger.info(
    { preferredDay, freeSlots: freeSlots.length, busySlots: busySlots.length },
    'Free slots calculated'
  )

  if (freeSlots.length === 0) {
    return {
      responseText: `Niestety w dniu ${preferredDay} nie mamy wolnych terminów na ${usluga.Nazwa}. Proszę wybrać inny dzień.`,
      uslugaId: usluga.id,
      pracownikId: pracownik?.id,
      calendarId,
    }
  }

  // If user specified preferred time (e.g. "from 16:00"), filter slots to start from that hour
  let slotsToShow = freeSlots
  if (ctx.preferredTime) {
    const [prefH, prefM] = ctx.preferredTime.split(':').map(Number)
    const prefMinutes = prefH * 60 + (prefM || 0)
    const fromPreferred = freeSlots.filter(slot => {
      const [h, m] = slot.split(':').map(Number)
      return h * 60 + m >= prefMinutes
    })
    // Use filtered slots if any exist, otherwise fall back to all slots
    if (fromPreferred.length > 0) slotsToShow = fromPreferred
  }

  const topSlots = slotsToShow.slice(0, 5)
  const slotsText = topSlots.join(', ')
  const moreInfo = slotsToShow.length > 5 ? ` (i ${slotsToShow.length - 5} więcej)` : ''

  return {
    responseText: `Mamy wolne terminy na ${usluga.Nazwa} (${usluga.czas_trwania_min} min, ${usluga.cena} PLN) w dniu ${preferredDay}:\n⏰ ${slotsText}${moreInfo}\n\nKtóra godzina Pani/Panu odpowiada?`,
    availableSlots: topSlots,
    uslugaId: usluga.id,
    pracownikId: pracownik?.id,
    calendarId,
  }
}
