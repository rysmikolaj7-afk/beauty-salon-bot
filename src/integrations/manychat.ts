import { logger } from '../lib/logger.js'

export async function sendManyChatMessage(
  subscriberId: string,
  text: string,
  apiKey: string
): Promise<boolean> {
  try {
    const res = await fetch('https://api.manychat.com/fb/sending/sendContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        data: {
          version: 'v2',
          content: {
            messages: [{ type: 'text', text }],
          },
        },
      }),
    })
    const data = (await res.json()) as { status: string; message?: string }
    if (data.status !== 'success') {
      logger.error(
        { subscriberId, status: data.status, message: data.message },
        'ManyChat sendContent failed'
      )
      return false
    }
    logger.debug({ subscriberId }, 'ManyChat message sent')
    return true
  } catch (err) {
    logger.error({ subscriberId, err }, 'ManyChat sendContent error')
    return false
  }
}
