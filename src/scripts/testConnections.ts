import { getSalon } from '../db/airtable.js'
import { sendMessage } from '../integrations/telegram.js'
import { testAIConnection } from '../ai/client.js'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'

async function main() {
  console.log('\n=== Beauty Salon AI — Connection Test ===\n')

  console.log('1. Testing Airtable...')
  const salonId = config.TEST_SALON_ID || 'recavm4YdbC3SaZw7'
  const salon = await getSalon(salonId)
  if (salon) {
    console.log(`   OK — Salon: "${salon.Nazwa}" (${salon.id})`)
  } else {
    console.log('   FAILED — could not fetch salon')
    process.exit(1)
  }

  console.log('\n2. Testing OpenAI...')
  try {
    const aiResponse = await testAIConnection()
    console.log(`   OK — Response: "${aiResponse}"`)
  } catch (err) {
    console.log('   FAILED:', err)
    process.exit(1)
  }

  console.log('\n3. Testing Telegram...')
  const ownerId = config.TEST_OWNER_TELEGRAM_ID || '8731593494'
  const sent = await sendMessage(ownerId, 'Test polaczenia — nowy backend dziala!')
  if (sent) {
    console.log(`   OK — Message sent to ${ownerId}`)
  } else {
    console.log('   FAILED')
    process.exit(1)
  }

  console.log('\nAll connections OK! M1 complete.\n')
}

main().catch((err) => {
  logger.error(err)
  process.exit(1)
})
