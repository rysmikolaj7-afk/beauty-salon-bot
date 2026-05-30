import { generateObject } from 'ai'
import { openai, AI_MODEL } from '../ai/client.js'
import { AdminCommandSchema } from '../ai/schemas.js'
import { logger } from '../lib/logger.js'
import {
  createPracownik,
  deactivatePracownik,
  findPracownikByName,
} from '../db/repos/pracownicy.js'
import { findUsluga, updateCenaUslugi } from '../db/repos/uslugi.js'
import { listTodayRezerwacje } from '../db/repos/rezerwacje.js'
import {
  findEskalacjaByNumber,
  closeEskalacja,
  getSubscriberIdForEskalacja,
} from '../db/repos/eskalacje.js'
import type { RouteResult } from './router.js'

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
