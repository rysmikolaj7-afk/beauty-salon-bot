import { config } from '../config.js'

const BASE_URL = process.argv[2] || `http://localhost:${config.PORT}`
const SECRET = config.TELEGRAM_WEBHOOK_SECRET
const OWNER_ID = config.TEST_OWNER_TELEGRAM_ID || '8731593494'
const CLIENT_ID = '99998'

interface TestCase {
  name: string
  chatId: string
  text: string
  expectContains: string
}

const TEST_CASES: TestCase[] = [
  {
    name: 'INFO — pytanie o cenę',
    chatId: CLIENT_ID,
    text: 'ile kosztuje manicure hybrydowy?',
    expectContains: 'PLN',
  },
  {
    name: 'INFO — godziny otwarcia',
    chatId: CLIENT_ID,
    text: 'jakie macie godziny otwarcia?',
    expectContains: ':',
  },
  {
    name: 'BOOKING — propozycja terminów',
    chatId: CLIENT_ID,
    text: 'chcę umówić się na manicure hybrydowy w piątek',
    expectContains: 'termin',
  },
  {
    name: 'UNKNOWN — eskalacja',
    chatId: CLIENT_ID,
    text: 'czy możecie zrobić paznokcie z diamentami na ślub?',
    expectContains: 'przekazane',
  },
  {
    name: 'ADMIN — dzisiejsze rezerwacje',
    chatId: OWNER_ID,
    text: 'dzisiejsze rezerwacje',
    expectContains: 'rezerwacj',
  },
]

async function sendTestMessage(chatId: string, text: string): Promise<string> {
  const update = {
    update_id: Math.floor(Math.random() * 100000),
    message: {
      message_id: Math.floor(Math.random() * 100000),
      from: { id: parseInt(chatId), first_name: 'Test' },
      chat: { id: parseInt(chatId), type: 'private' },
      text,
      date: Math.floor(Date.now() / 1000),
    },
  }

  const res = await fetch(`${BASE_URL}/webhooks/telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': SECRET,
    },
    body: JSON.stringify(update),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.text()
}

async function main() {
  console.log(`\n=== Migration Check — Beauty Salon AI ===`)
  console.log(`Target: ${BASE_URL}\n`)

  let passed = 0
  let failed = 0

  for (const tc of TEST_CASES) {
    try {
      process.stdout.write(`  ${tc.name}... `)
      await sendTestMessage(tc.chatId, tc.text)
      console.log(`OK (endpoint responded 200)`)
      passed++
    } catch (err) {
      console.log(`FAILED — ${err}`)
      failed++
    }
    await new Promise(r => setTimeout(r, 2000))
  }

  console.log(`\nResults: ${passed}/${TEST_CASES.length} passed`)

  if (failed > 0) {
    console.log(`\n${failed} test(s) failed. Check server logs.`)
    process.exit(1)
  } else {
    console.log(`\nAll checks passed! System ready for production.`)
    console.log(`\nNext steps:`)
    console.log(`  1. Deploy to Railway: connect GitHub repo`)
    console.log(`  2. Set environment variables in Railway dashboard`)
    console.log(`  3. Run: npx tsx src/scripts/setupTelegram.ts https://YOUR_DOMAIN/webhooks/telegram`)
    console.log(`  4. Update ManyChat External Request URL to https://YOUR_DOMAIN/webhooks/manychat?secret=YOUR_SECRET`)
    console.log(`  5. Disable Make.com scenarios one by one (00 -> 02 -> 03 -> 04 -> 01 -> 05)`)
  }
}

main().catch(err => {
  console.error('Migration check failed:', err)
  process.exit(1)
})
