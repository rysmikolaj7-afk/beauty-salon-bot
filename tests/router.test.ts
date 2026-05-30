import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/db/airtable.js', () => ({
  getSalon: vi.fn().mockResolvedValue({
    id: 'recavm4YdbC3SaZw7',
    Nazwa: 'Bella Beauty Warszawa',
    owner_telegram_id: '8731593494',
    system_prompt: 'test',
    manychat_api_key: '',
    owner_subscriber_id: '',
    godziny_otwarcia: '9-18',
  }),
}))

vi.mock('../src/config.js', () => ({
  config: {
    AIRTABLE_API_KEY: 'test',
    AIRTABLE_BASE_ID: 'test',
    OPENAI_API_KEY: 'test',
    TELEGRAM_BOT_TOKEN: 'test',
    TELEGRAM_WEBHOOK_SECRET: 'test-secret-token',
    PORT: 3000,
    NODE_ENV: 'test',
    TEST_SALON_ID: 'recavm4YdbC3SaZw7',
    TEST_OWNER_TELEGRAM_ID: '8731593494',
  },
}))

vi.mock('../src/lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('router', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('recognizes owner by telegram ID', async () => {
    const { route } = await import('../src/core/router.js')
    const { parseTelegramUpdate } = await import('../src/channels/telegram.js')

    const msg = parseTelegramUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 8731593494, first_name: 'Mikołaj' },
        chat: { id: 8731593494, type: 'private' },
        text: 'dzisiejsze rezerwacje',
        date: Date.now(),
      },
    })

    expect(msg).not.toBeNull()
    const result = await route(msg!)
    expect(result?.isOwner).toBe(true)
  })

  it('recognizes client (non-owner)', async () => {
    const { route } = await import('../src/core/router.js')
    const { parseTelegramUpdate } = await import('../src/channels/telegram.js')

    const msg = parseTelegramUpdate({
      update_id: 2,
      message: {
        message_id: 2,
        from: { id: 99999, first_name: 'Anna' },
        chat: { id: 99999, type: 'private' },
        text: 'ile kosztuje manicure',
        date: Date.now(),
      },
    })

    expect(msg).not.toBeNull()
    const result = await route(msg!)
    expect(result?.isOwner).toBe(false)
    expect(result?.salon.Nazwa).toBe('Bella Beauty Warszawa')
  })

  it('returns null for update without text', async () => {
    const { parseTelegramUpdate } = await import('../src/channels/telegram.js')

    const msg = parseTelegramUpdate({
      update_id: 3,
      message: {
        message_id: 3,
        from: { id: 12345, first_name: 'Bot' },
        chat: { id: 12345, type: 'private' },
        date: Date.now(),
      },
    })

    expect(msg).toBeNull()
  })

  it('returns null for update without message', async () => {
    const { parseTelegramUpdate } = await import('../src/channels/telegram.js')

    const msg = parseTelegramUpdate({ update_id: 4 })
    expect(msg).toBeNull()
  })
})
