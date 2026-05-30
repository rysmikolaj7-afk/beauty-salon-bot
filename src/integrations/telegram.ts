import { config } from '../config.js'
import { logger } from '../lib/logger.js'

const TELEGRAM_API = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`

export async function sendMessage(chatId: string | number, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    const data = await res.json() as { ok: boolean; description?: string }
    if (!data.ok) {
      logger.error({ chatId, description: data.description }, 'Telegram sendMessage failed')
      return false
    }
    logger.debug({ chatId }, 'Telegram message sent')
    return true
  } catch (err) {
    logger.error({ chatId, err }, 'Telegram sendMessage error')
    return false
  }
}

export async function setWebhook(url: string, secretToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, secret_token: secretToken }),
    })
    const data = await res.json() as { ok: boolean; description?: string }
    logger.info({ url, ok: data.ok }, 'Telegram webhook setup')
    return data.ok
  } catch (err) {
    logger.error({ err }, 'Failed to set Telegram webhook')
    return false
  }
}
