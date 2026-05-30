import { setWebhook } from '../integrations/telegram.js'
import { config } from '../config.js'

const webhookUrl = process.argv[2]

if (!webhookUrl) {
  console.error('Usage: npx tsx src/scripts/setupTelegram.ts https://your-domain.com/webhooks/telegram')
  process.exit(1)
}

const ok = await setWebhook(webhookUrl, config.TELEGRAM_WEBHOOK_SECRET)
console.log(ok ? `Webhook set to ${webhookUrl}` : 'Failed to set webhook')
