import { z } from 'zod'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env') })

const ConfigSchema = z.object({
  AIRTABLE_API_KEY: z.string().min(1, 'AIRTABLE_API_KEY is required'),
  AIRTABLE_BASE_ID: z.string().min(1, 'AIRTABLE_BASE_ID is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16, 'TELEGRAM_WEBHOOK_SECRET must be at least 16 chars'),
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TEST_SALON_ID: z.string().optional(),
  TEST_OWNER_TELEGRAM_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  MANYCHAT_WEBHOOK_SECRET: z.string().default('beauty-manychat-secret-2026-dev'),
  FILLOUT_WEBHOOK_SECRET: z.string().default('beauty-fillout-secret-2026-dev'),
})

const parsed = ConfigSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data
