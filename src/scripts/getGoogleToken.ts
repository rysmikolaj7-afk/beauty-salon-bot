/**
 * Skrypt do jednorazowego pobrania Google OAuth refresh token.
 * Uruchom: npx tsx src/scripts/getGoogleToken.ts
 */
import { google } from 'googleapis'
import * as readline from 'readline'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '..', '.env') })

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

if (!CLIENT_ID || CLIENT_ID === 'FILL_IN') {
  console.error('❌ Ustaw GOOGLE_CLIENT_ID w pliku .env')
  process.exit(1)
}
if (!CLIENT_SECRET || CLIENT_SECRET === 'FILL_IN') {
  console.error('❌ Ustaw GOOGLE_CLIENT_SECRET w pliku .env')
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'  // Desktop app redirect
)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar'],
  prompt: 'consent',  // Wymusza zwrócenie refresh_token
})

console.log('\n=== Google Calendar — pobranie refresh token ===\n')
console.log('1. Otwórz ten URL w przeglądarce:\n')
console.log(authUrl)
console.log('\n2. Zaloguj się na konto mikirys3333@gmail.com')
console.log('3. Kliknij "Zezwól"')
console.log('4. Skopiuj kod który się pojawi\n')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

rl.question('Wklej kod tutaj: ', async (code) => {
  rl.close()
  try {
    const { tokens } = await oauth2Client.getToken(code.trim())
    console.log('\n✅ Sukces!\n')
    console.log('Dodaj do pliku .env:')
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log('\nRefresh token:', tokens.refresh_token)
  } catch (err) {
    console.error('❌ Błąd:', err)
  }
})
