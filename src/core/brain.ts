import { generateObject } from 'ai'
import { openai, AI_MODEL } from '../ai/client.js'
import { BrainOutputSchema } from '../ai/schemas.js'
import { buildBrainSystemPrompt } from '../ai/prompts.js'
import { findOrCreateKlient } from '../db/repos/klienci.js'
import { findOrCreateKonwersacja } from '../db/repos/konwersacje.js'
import { getLastMessages, createWiadomosc } from '../db/repos/wiadomosci.js'
import { listUslugi } from '../db/repos/uslugi.js'
import { listPracownicy } from '../db/repos/pracownicy.js'
import { logger } from '../lib/logger.js'
import { config } from '../config.js'
import type { RouteResult } from './router.js'
import type { Wiadomosc } from '../db/repos/wiadomosci.js'

function extractBookingContext(historia: Wiadomosc[]): {
  service_name: string | null
  preferred_day: string | null
} {
  let service_name: string | null = null
  let preferred_day: string | null = null

  for (const w of [...historia].reverse()) {
    if (w.kierunek === 'wychodzaca') {
      if (!preferred_day) {
        const dateMatch = w.tresc.match(/\d{4}-\d{2}-\d{2}/)
        if (dateMatch) preferred_day = dateMatch[0]
      }
    }
  }

  return { service_name, preferred_day }
}

export async function processBrain(routeResult: RouteResult): Promise<string> {
  const { salon, message } = routeResult
  const today = new Date().toISOString().split('T')[0]

  const [uslugi, pracownicy] = await Promise.all([
    listUslugi(salon.Nazwa),
    listPracownicy(salon.Nazwa),
  ])

  const klient = await findOrCreateKlient(
    message.subscriberId,
    message.fullName,
    salon.id,
    salon.Nazwa
  )

  const konwersacja = await findOrCreateKonwersacja(klient.id, klient.Imie_Nazwisko, salon.id)

  const historia = await getLastMessages(konwersacja.ID_Konwersacji, 10)
  const historiaAsc = [...historia].reverse()

  await createWiadomosc(message.text, 'przychodzaca', 'klient', konwersacja.id)

  const systemPrompt = buildBrainSystemPrompt(salon, uslugi, pracownicy, klient.notatki, today)

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = historiaAsc.map(w => ({
    role: w.kierunek === 'przychodzaca' ? 'user' : 'assistant',
    content: w.tresc,
  }))
  messages.push({ role: 'user', content: message.text })

  const { object } = await generateObject({
    model: openai(AI_MODEL),
    schema: BrainOutputSchema,
    system: systemPrompt,
    messages,
  })

  logger.info({ intent: object.intent, chatId: message.chatId }, 'Brain classified intent')

  if (object.intent === 'BOOKING') {
    const { processBooking } = await import('./booking.js')
    const bookingResult = await processBooking({
      salon,
      serviceName: object.service_name || '',
      preferredDay: object.preferred_day || new Date().toISOString().split('T')[0],
      clientId: klient.id,
      conversationId: konwersacja.id,
      subscriberId: message.subscriberId,
    })
    await createWiadomosc(bookingResult.responseText, 'wychodzaca', 'ai', konwersacja.id)
    return bookingResult.responseText
  }

  if (object.intent === 'CONFIRM') {
    const { processConfirm } = await import('./booking.js')

    let serviceName = object.service_name || ''
    let preferredDay = object.preferred_day || ''

    if (!serviceName || !preferredDay) {
      const ctx = extractBookingContext(historia)
      if (!serviceName) serviceName = ctx.service_name || ''
      if (!preferredDay) preferredDay = ctx.preferred_day || new Date().toISOString().split('T')[0]
    }

    const confirmResult = await processConfirm({
      salon,
      serviceName,
      preferredDay,
      preferredTime: object.preferred_time || '',
      clientId: klient.id,
      conversationId: konwersacja.id,
      subscriberId: message.subscriberId,
    })
    await createWiadomosc(confirmResult.responseText, 'wychodzaca', 'ai', konwersacja.id)
    return confirmResult.responseText
  }

  if (object.intent === 'UNKNOWN') {
    const { createEskalacja } = await import('../db/repos/eskalacje.js')
    const eskalacja = await createEskalacja(message.text, konwersacja.id)

    const ownerTelegramId = salon.owner_telegram_id || config.TEST_OWNER_TELEGRAM_ID
    if (ownerTelegramId) {
      const { sendMessage } = await import('../integrations/telegram.js')
      await sendMessage(
        ownerTelegramId,
        `🔔 Eskalacja #${eskalacja.Numer}\nKlient: ${klient.Imie_Nazwisko}\nPytanie: ${message.text}\n\nAby odpowiedzieć, napisz: odpowiedz ${eskalacja.Numer} [treść]`
      )
    }

    const responseText = 'Dziękuję za pytanie. Zostało ono przekazane do właściciela salonu, który odpowie wkrótce. 😊'
    await createWiadomosc(responseText, 'wychodzaca', 'ai', konwersacja.id)
    return responseText
  }

  // INFO (domyślnie)
  const responseText = object.response_text
  await createWiadomosc(responseText, 'wychodzaca', 'ai', konwersacja.id)
  return responseText
}
