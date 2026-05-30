import type { IncomingMessage } from './telegram.js'

export interface ManyChatPayload {
  page_id: string
  subscriber_id: string
  full_name: string
  last_input_text: string
}

export function parseManyChatWebhook(body: unknown): IncomingMessage | null {
  const payload = body as ManyChatPayload
  if (!payload?.subscriber_id || !payload?.last_input_text) return null

  return {
    channel: 'manychat' as const,
    chatId: payload.subscriber_id,
    subscriberId: payload.subscriber_id,
    fullName: payload.full_name || 'Klientka',
    text: payload.last_input_text,
    rawUpdate: payload as unknown as Record<string, unknown>,
  }
}

export function getManyChatPageId(body: unknown): string | null {
  return (body as ManyChatPayload)?.page_id || null
}
