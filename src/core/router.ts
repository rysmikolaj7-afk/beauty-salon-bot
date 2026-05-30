import { getSalon, findSalonByPageId, type Salon } from '../db/airtable.js'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'
import type { IncomingMessage } from '../channels/telegram.js'

export interface RouteResult {
  salon: Salon
  isOwner: boolean
  message: IncomingMessage
}

export async function route(message: IncomingMessage, pageId?: string): Promise<RouteResult | null> {
  let salon: Salon | null = null

  if (message.channel === 'manychat' && pageId) {
    salon = await findSalonByPageId(pageId)
  } else {
    const salonId = config.TEST_SALON_ID
    if (!salonId) {
      logger.error('TEST_SALON_ID not configured')
      return null
    }
    salon = await getSalon(salonId)
  }

  if (!salon) {
    logger.error({ channel: message.channel, pageId }, 'Could not load salon')
    return null
  }

  const isOwner =
    (salon.owner_telegram_id != null && salon.owner_telegram_id === message.chatId) ||
    (salon.owner_subscriber_id != null && salon.owner_subscriber_id === message.chatId) ||
    (config.TEST_OWNER_TELEGRAM_ID != null && config.TEST_OWNER_TELEGRAM_ID === message.chatId)

  logger.debug({ chatId: message.chatId, isOwner, salon: salon.Nazwa }, 'Routed message')

  return { salon, isOwner, message }
}
