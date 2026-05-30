import { google } from 'googleapis'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '..', '.env') })

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
)

const { tokens } = await oauth2Client.getToken('4/1AeoWuM_k6cuHVn0ssM2A2XGcrIrzVTJj4FKvcv-yr7Ff_1wAGy8YpM9csRQ')
console.log('REFRESH_TOKEN:', tokens.refresh_token)
