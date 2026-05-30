import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/db/airtable.js', () => ({
  getSalon: vi.fn().mockResolvedValue({
    id: 'recavm4YdbC3SaZw7',
    Nazwa: 'Bella Beauty Warszawa',
    system_prompt: 'Jesteś recepcjonistką salonu Bella Beauty.',
    owner_telegram_id: '8731593494',
    godziny_otwarcia: '9:00-18:00',
    manychat_api_key: '',
    owner_subscriber_id: '',
  }),
}))

vi.mock('../src/db/repos/klienci.js', () => ({
  findOrCreateKlient: vi.fn().mockResolvedValue({
    id: 'recKlient1',
    Imie_Nazwisko: 'Anna Testowa',
    notatki: '',
  }),
}))

vi.mock('../src/db/repos/konwersacje.js', () => ({
  findOrCreateKonwersacja: vi.fn().mockResolvedValue({
    id: 'recKonwersacja1',
    ID_Konwersacji: 'CONV-TEST-001',
  }),
}))

vi.mock('../src/db/repos/wiadomosci.js', () => ({
  getLastMessages: vi.fn().mockResolvedValue([]),
  createWiadomosc: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/db/repos/uslugi.js', () => ({
  listUslugi: vi.fn().mockResolvedValue([
    { id: 'rec1', Nazwa: 'Manicure hybrydowy', cena: 110, czas_trwania_min: 60 },
    { id: 'rec2', Nazwa: 'Regulacja brwi', cena: 50, czas_trwania_min: 30 },
  ]),
}))

vi.mock('../src/db/repos/pracownicy.js', () => ({
  listPracownicy: vi.fn().mockResolvedValue([
    { id: 'recP1', Imie_Nazwisko: 'Marta Wiśniewska', email: 'marta@test.com', calendar_id: 'marta@test.com' },
  ]),
}))

vi.mock('../src/ai/client.js', () => ({
  openai: vi.fn(),
  AI_MODEL: 'gpt-4o-mini',
}))

vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      intent: 'INFO',
      response_text: 'Manicure hybrydowy kosztuje 110 PLN i trwa 60 minut.',
    },
  }),
}))

const mockRouteResult = {
  salon: {
    id: 'recavm4YdbC3SaZw7',
    Nazwa: 'Bella Beauty Warszawa',
    system_prompt: 'test',
    owner_telegram_id: '8731593494',
    godziny_otwarcia: '9:00-18:00',
    manychat_api_key: '',
    owner_subscriber_id: '',
  },
  isOwner: false,
  message: {
    channel: 'telegram' as const,
    chatId: '99999',
    subscriberId: '99999',
    fullName: 'Anna Testowa',
    text: 'ile kosztuje manicure hybrydowy?',
    rawUpdate: {} as any,
  },
}

vi.mock('../src/db/repos/eskalacje.js', () => ({
  createEskalacja: vi.fn().mockResolvedValue({ id: 'recEsk1', Numer: 1, pytanie: 'test', status: 'otwarta' }),
}))

vi.mock('../src/integrations/telegram.js', () => ({
  sendMessage: vi.fn().mockResolvedValue(true),
}))

describe('brain — INFO path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns response_text for INFO intent', async () => {
    const { processBrain } = await import('../src/core/brain.js')
    const result = await processBrain(mockRouteResult)
    expect(result).toBe('Manicure hybrydowy kosztuje 110 PLN i trwa 60 minut.')
  })

  it('saves incoming and outgoing messages', async () => {
    const { processBrain } = await import('../src/core/brain.js')
    await processBrain(mockRouteResult)

    const { createWiadomosc } = await import('../src/db/repos/wiadomosci.js')
    expect(createWiadomosc).toHaveBeenCalledTimes(2)

    const calls = vi.mocked(createWiadomosc).mock.calls
    expect(calls[0]).toEqual(['ile kosztuje manicure hybrydowy?', 'przychodzaca', 'klient', 'recKonwersacja1'])
    expect(calls[1]).toEqual(['Manicure hybrydowy kosztuje 110 PLN i trwa 60 minut.', 'wychodzaca', 'ai', 'recKonwersacja1'])
  })
})

describe('brain — multi-turn CONFIRM with history context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('extracts booking context from history when AI returns null fields', async () => {
    vi.doMock('../src/core/booking.js', () => ({
      processBooking: vi.fn().mockResolvedValue({ responseText: 'Wolne terminy: 10:00' }),
      processConfirm: vi.fn().mockResolvedValue({ responseText: 'Rezerwacja potwierdzona! 10:00' }),
    }))

    const { getLastMessages } = await import('../src/db/repos/wiadomosci.js')
    vi.mocked(getLastMessages).mockResolvedValueOnce([
      {
        id: 'msg1',
        tresc: 'Mamy wolne terminy na Manicure hybrydowy w dniu 2026-06-06: 10:00, 11:00',
        kierunek: 'wychodzaca',
        nadawca_typ: 'ai',
        timestamp: new Date().toISOString(),
      },
    ])

    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        intent: 'CONFIRM',
        service_name: null,
        preferred_day: null,
        preferred_time: '10:00',
        response_text: 'Rezerwacja potwierdzona! 10:00',
      },
    } as any)

    const { processBrain } = await import('../src/core/brain.js')
    const result = await processBrain({
      salon: {
        id: 'recavm4YdbC3SaZw7',
        Nazwa: 'Bella Beauty Warszawa',
        system_prompt: 'test',
        owner_telegram_id: '8731593494',
        godziny_otwarcia: '9:00-18:00',
        manychat_api_key: '',
        owner_subscriber_id: '',
      },
      isOwner: false,
      message: {
        channel: 'telegram' as const,
        chatId: '99999',
        subscriberId: '99999',
        fullName: 'Anna Testowa',
        text: '10:00 proszę',
        rawUpdate: {} as any,
      },
    })

    const { processConfirm } = await import('../src/core/booking.js')
    expect(vi.mocked(processConfirm)).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredTime: '10:00',
        preferredDay: '2026-06-06',
      })
    )
    expect(result).toContain('potwierdzona')
  })
})

describe('brain — UNKNOWN path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('creates escalation and returns przekazane message for UNKNOWN intent', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        intent: 'UNKNOWN',
        response_text: 'Przekazuję pytanie do właściciela.',
      },
    } as any)

    const { processBrain } = await import('../src/core/brain.js')
    const result = await processBrain({
      salon: {
        id: 'recavm4YdbC3SaZw7',
        Nazwa: 'Bella Beauty Warszawa',
        system_prompt: 'test',
        owner_telegram_id: undefined,
        godziny_otwarcia: '9:00-18:00',
        manychat_api_key: '',
        owner_subscriber_id: '',
      },
      isOwner: false,
      message: {
        channel: 'telegram' as const,
        chatId: '99999',
        subscriberId: '99999',
        fullName: 'Anna Testowa',
        text: 'czy macie zniżki dla studentów?',
        rawUpdate: {} as any,
      },
    })

    expect(result).toContain('przekazane')

    const { createEskalacja } = await import('../src/db/repos/eskalacje.js')
    expect(createEskalacja).toHaveBeenCalledWith(
      'czy macie zniżki dla studentów?',
      'recKonwersacja1'
    )
  })
})
