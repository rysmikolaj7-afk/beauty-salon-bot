import Fastify from 'fastify'
import { config } from './config.js'
import { logger } from './lib/logger.js'
import { parseTelegramUpdate, type TelegramUpdate } from './channels/telegram.js'
import { parseManyChatWebhook, getManyChatPageId } from './channels/manychat.js'
import { route } from './core/router.js'
import { sendMessage } from './integrations/telegram.js'

const app = Fastify({ logger: false })

app.get('/healthz', async () => {
  return { status: 'ok', timestamp: new Date().toISOString(), env: config.NODE_ENV }
})

app.post('/webhooks/telegram', async (request, reply) => {
  const secret = request.headers['x-telegram-bot-api-secret-token']
  if (typeof secret !== 'string' || secret !== config.TELEGRAM_WEBHOOK_SECRET) {
    logger.warn('Telegram webhook: invalid secret token')
    return reply.status(401).send({ ok: false })
  }

  const update = request.body as TelegramUpdate
  const message = parseTelegramUpdate(update)

  if (!message) {
    return reply.status(200).send({ ok: true })
  }

  const result = await route(message)

  if (!result) {
    logger.error({ chatId: message.chatId }, 'Routing failed — no salon found')
    return reply.status(200).send({ ok: true })
  }

  if (result.isOwner) {
    try {
      const { processAdmin } = await import('./core/admin.js')
      const adminResponse = await processAdmin(result)
      await sendMessage(message.chatId, adminResponse)
    } catch (err) {
      logger.error({ err, chatId: message.chatId }, 'processAdmin failed')
      await sendMessage(message.chatId, 'Przepraszam, wystąpił problem z wykonaniem komendy. Spróbuj za chwilę.')
    }
  } else {
    try {
      const { processBrain } = await import('./core/brain.js')
      const responseText = await processBrain(result)
      await sendMessage(message.chatId, responseText)
    } catch (err) {
      logger.error({ err, chatId: message.chatId }, 'processBrain failed')
      await sendMessage(message.chatId, 'Przepraszam, chwilowo mam problem z odpowiedzią. Spróbuj za chwilę.')
    }
  }

  return reply.status(200).send({ ok: true })
})

// ── ManyChat webhook ──────────────────────────────────────────────
app.post('/webhooks/manychat', async (request, reply) => {
  const secret = (request.query as Record<string, string>).secret
  if (secret !== config.MANYCHAT_WEBHOOK_SECRET) {
    logger.warn('ManyChat webhook: invalid secret')
    return reply.status(401).send({ ok: false })
  }

  const pageId = getManyChatPageId(request.body)
  const message = parseManyChatWebhook(request.body)

  if (!message) return reply.status(200).send({ ok: true })

  const result = await route(message, pageId || undefined)
  if (!result) {
    logger.error({ subscriberId: message.subscriberId }, 'ManyChat routing failed')
    return reply.status(200).send({ ok: true })
  }

  const respond = async (text: string) => {
    const { sendManyChatMessage } = await import('./integrations/manychat.js')
    await sendManyChatMessage(message.subscriberId, text, result.salon.manychat_api_key)
  }

  if (result.isOwner) {
    try {
      const { processAdmin } = await import('./core/admin.js')
      const adminResponse = await processAdmin(result)
      await respond(adminResponse)
    } catch (err) {
      logger.error({ err }, 'ManyChat processAdmin failed')
      await respond('Przepraszam, wystąpił problem. Spróbuj za chwilę.')
    }
  } else {
    try {
      const { processBrain } = await import('./core/brain.js')
      const responseText = await processBrain(result)
      await respond(responseText)
    } catch (err) {
      logger.error({ err }, 'ManyChat processBrain failed')
      await respond('Przepraszam, chwilowo mam problem z odpowiedzią. Spróbuj za chwilę.')
    }
  }

  return reply.status(200).send({ ok: true })
})

// ── Fillout onboarding webhook ────────────────────────────────────
app.post('/webhooks/fillout', async (request, reply) => {
  const secret = (request.query as Record<string, string>).secret
  if (secret !== config.FILLOUT_WEBHOOK_SECRET) {
    return reply.status(401).send({ ok: false })
  }

  try {
    const { processSetup } = await import('./core/setup.js')
    const body = request.body as Record<string, unknown>

    const getField = (name: string): string => (body[name] as string) || ''

    const uslugiRaw = (body.uslugi as string) || '[]'
    const pracownicyRaw = (body.pracownicy as string) || '[]'

    const uslugi = JSON.parse(uslugiRaw)
    const pracownicy = JSON.parse(pracownicyRaw)

    // Validate structure before writing to Airtable
    if (!Array.isArray(uslugi) || uslugi.some((u: unknown) =>
      typeof u !== 'object' || u === null || !(u as Record<string, unknown>).nazwa || (u as Record<string, unknown>).cena == null
    )) {
      return reply.status(400).send({ success: false, message: 'Nieprawidłowa struktura uslugi. Wymagane: nazwa, cena, czas_trwania_min.' })
    }
    if (!Array.isArray(pracownicy) || pracownicy.some((p: unknown) =>
      typeof p !== 'object' || p === null || !(p as Record<string, unknown>).imie_nazwisko || !(p as Record<string, unknown>).email
    )) {
      return reply.status(400).send({ success: false, message: 'Nieprawidłowa struktura pracownicy. Wymagane: imie_nazwisko, email.' })
    }

    const result = await processSetup({
      salon_name: getField('salon_name'),
      manychat_page_id: getField('manychat_page_id'),
      owner_subscriber_id: getField('owner_subscriber_id'),
      owner_telegram_id: getField('owner_telegram_id') || undefined,
      manychat_api_key: getField('manychat_api_key'),
      godziny_otwarcia: getField('godziny_otwarcia') || '9:00-18:00',
      system_prompt: getField('system_prompt') || undefined,
      uslugi,
      pracownicy,
    })

    return reply.status(200).send(result)
  } catch (err) {
    logger.error({ err }, 'Fillout webhook error')
    return reply.status(200).send({ success: false, message: 'Internal error' })
  }
})

const start = async () => {
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' })
    logger.info({ port: config.PORT }, 'Server running')
  } catch (err) {
    logger.error(err, 'Server failed to start')
    process.exit(1)
  }
}

start()
