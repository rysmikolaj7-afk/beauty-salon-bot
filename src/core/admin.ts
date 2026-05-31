import { generateObject } from 'ai'
import { openai, AI_MODEL } from '../ai/client.js'
import { AdminCommandSchema } from '../ai/schemas.js'
import { logger } from '../lib/logger.js'
import {
  createPracownik,
  deactivatePracownik,
  findPracownikByName,
  listPracownicy,
} from '../db/repos/pracownicy.js'
import { findUsluga, updateCenaUslugi, listUslugi } from '../db/repos/uslugi.js'
import { listTodayRezerwacje, listRezerwacjeByDate } from '../db/repos/rezerwacje.js'
import {
  findEskalacjaByNumber,
  closeEskalacja,
  getSubscriberIdForEskalacja,
} from '../db/repos/eskalacje.js'
import type { RouteResult } from './router.js'

function parseDateRange(
  dateRange: string | null | undefined,
  today: string
): { from: string; to: string; label: string } {
  const todayDate = new Date(today)

  if (!dateRange || dateRange === 'null') {
    const to = new Date(todayDate)
    to.setDate(to.getDate() + 7)
    return { from: today, to: to.toISOString().split('T')[0], label: `${today} – ${to.toISOString().split('T')[0]}` }
  }

  const lower = dateRange.toLowerCase().trim()

  if (lower === 'jutro') {
    const tomorrow = new Date(todayDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    return { from: tomorrowStr, to: tomorrowStr, label: tomorrowStr }
  }

  if (lower.includes('tydzień') || lower.includes('tydzie') || lower.includes('week')) {
    const to = new Date(todayDate)
    to.setDate(to.getDate() + 7)
    return { from: today, to: to.toISOString().split('T')[0], label: `${today} – ${to.toISOString().split('T')[0]}` }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateRange)) {
    return { from: dateRange, to: dateRange, label: dateRange }
  }

  const to = new Date(todayDate)
  to.setDate(to.getDate() + 7)
  return { from: today, to: to.toISOString().split('T')[0], label: `${today} – ${to.toISOString().split('T')[0]}` }
}

export async function processAdmin(routeResult: RouteResult): Promise<string> {
  const { salon, message } = routeResult

  const { object } = await generateObject({
    model: openai(AI_MODEL),
    schema: AdminCommandSchema,
    system: `Jesteś asystentem właścicielki salonu beauty. Klasyfikuj komendy zarządzania salonem.

Możliwe komendy:
- ADD_STAFF: dodaj pracownika (params: name, email)
- REMOVE_STAFF: usuń/dezaktywuj pracownika (params: name)
- UPDATE_PRICE: zmień cenę usługi (params: service_name, price)
- LIST_BOOKINGS: pokaż dzisiejsze rezerwacje (brak params)
- LIST_SERVICES: pokaż usługi, cennik, co oferujemy, jakie usługi mamy, lista usług
- LIST_STAFF: pokaż pracowników, kto pracuje, lista pracowników, personel
- LIST_UPCOMING: rezerwacje na jutro, rezerwacje na tydzień, najbliższe wizyty, plan na [data]
  → date_range: wpisz "jutro", "ten tydzień" lub datę YYYY-MM-DD; jeśli nie podano → null
- ESCALATION_REPLY: odpowiedź na eskalację (params: escalation_number, reply_text)
- UNKNOWN: nieznana komenda

Odpowiadaj WYŁĄCZNIE w formacie JSON bez markdown.`,
    messages: [{ role: 'user', content: message.text }],
  })

  logger.info({ command: object.command, chatId: message.chatId }, 'Admin command classified')

  switch (object.command) {
    case 'ADD_STAFF': {
      const name = object.params.name || ''
      const email = object.params.email || ''
      if (!name || !email) {
        return 'Podaj imię i nazwisko oraz email pracownika. Przykład: "dodaj pracownika Anna Kowalska anna@gmail.com"'
      }
      await createPracownik({ imieNazwisko: name, email, salonId: salon.id })
      return `Dodano pracownika ${name} (${email}). Poproś tę osobę o połączenie kalendarza Google z systemem.`
    }

    case 'REMOVE_STAFF': {
      const name = object.params.name || ''
      if (!name) return 'Podaj imię i nazwisko pracownika do usunięcia.'
      const pracownik = await findPracownikByName(salon.Nazwa, name)
      if (!pracownik) return `Nie znalazłam pracownika "${name}" w salonie.`
      await deactivatePracownik(pracownik.id)
      return `Pracownik ${name} został dezaktywowany i nie będzie już przypisywany do rezerwacji.`
    }

    case 'UPDATE_PRICE': {
      const serviceName = object.params.service_name || ''
      const price = object.params.price
      if (!serviceName || price == null) {
        return 'Podaj nazwę usługi i nową cenę. Przykład: "zmień cenę manicure hybrydowy na 120"'
      }
      const usluga = await findUsluga(salon.Nazwa, serviceName)
      if (!usluga) return `Nie znalazłam usługi "${serviceName}" w ofercie salonu.`
      await updateCenaUslugi(usluga.id, price)
      return `Zaktualizowano cenę usługi "${serviceName}" na ${price} PLN.`
    }

    case 'LIST_BOOKINGS': {
      const rezerwacje = await listTodayRezerwacje(salon.Nazwa)
      if (rezerwacje.length === 0) return 'Brak rezerwacji na dziś.'
      const lista = rezerwacje
        .map(r => `• ${r.godzina_rozpoczecia} — ${r.status}`)
        .join('\n')
      return `Dzisiejsze rezerwacje (${rezerwacje.length}):\n${lista}`
    }

    case 'LIST_SERVICES': {
      const uslugi = await listUslugi(salon.Nazwa)
      if (uslugi.length === 0) {
        return 'Brak aktywnych usług w salonie.'
      }
      const lista = uslugi
        .map(u => `• ${u.Nazwa} — ${u.cena} PLN, ${u.czas_trwania_min} min`)
        .join('\n')
      return `Aktywne usługi (${uslugi.length}):\n${lista}`
    }

    case 'LIST_STAFF': {
      const pracownicy = await listPracownicy(salon.Nazwa)
      if (pracownicy.length === 0) {
        return 'Brak aktywnych pracowników w salonie.'
      }
      const lista = pracownicy
        .map(p => `• ${p.Imie_Nazwisko} (${p.email})`)
        .join('\n')
      return `Aktywni pracownicy (${pracownicy.length}):\n${lista}`
    }

    case 'LIST_UPCOMING': {
      const today = new Date().toISOString().split('T')[0]
      const { from, to, label } = parseDateRange(object.params.date_range, today)
      const rezerwacje = await listRezerwacjeByDate(salon.Nazwa, from, to)
      if (rezerwacje.length === 0) {
        return `Brak rezerwacji w okresie ${label}.`
      }
      const lista = rezerwacje
        .map(r => `• ${r.data_wizyty} ${r.godzina_rozpoczecia} — ${r.status}`)
        .join('\n')
      return `Rezerwacje ${label} (${rezerwacje.length}):\n${lista}`
    }

    case 'ESCALATION_REPLY': {
      const num = object.params.escalation_number
      const reply = object.params.reply_text || ''
      if (!num || !reply) {
        return 'Podaj numer eskalacji i treść odpowiedzi. Przykład: "odpowiedz 3 Tak, mamy zniżki 10%"'
      }
      const eskalacja = await findEskalacjaByNumber(num)
      if (!eskalacja) return `Nie znalazłam eskalacji #${num}.`

      const subscriberId = await getSubscriberIdForEskalacja(eskalacja.id)
      if (subscriberId) {
        const { sendMessage } = await import('../integrations/telegram.js')
        await sendMessage(subscriberId, reply)
      }

      await closeEskalacja(eskalacja.id, reply)
      return `Odpowiedź wysłana do klientki. Eskalacja #${num} zamknięta.`
    }

    case 'UNKNOWN':
    default:
      return `Nie rozumiem komendy. Dostępne:\n• "dodaj pracownika [imię] [email]"\n• "usuń pracownika [imię]"\n• "zmień cenę [usługa] na [kwota]"\n• "dzisiejsze rezerwacje"\n• "odpowiedz [numer] [treść]"`
  }
}
