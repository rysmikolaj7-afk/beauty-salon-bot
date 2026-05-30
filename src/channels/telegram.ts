export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: { id: number; first_name: string; last_name?: string; username?: string }
    chat: { id: number; type: string }
    text?: string
    date: number
  }
}

export interface IncomingMessage {
  channel: 'telegram' | 'manychat'
  chatId: string
  subscriberId: string
  fullName: string
  text: string
  rawUpdate: TelegramUpdate | Record<string, unknown>
}

export function parseTelegramUpdate(update: TelegramUpdate): IncomingMessage | null {
  const msg = update.message
  if (!msg || !msg.text) return null

  const chatId = String(msg.chat.id)
  const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ')

  return {
    channel: 'telegram',
    chatId,
    subscriberId: chatId,
    fullName,
    text: msg.text,
    rawUpdate: update,
  }
}
