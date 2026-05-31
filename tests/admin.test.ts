import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/ai/client.js', () => ({
  openai: vi.fn(),
  AI_MODEL: 'gpt-4o-mini',
}))

vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: { command: 'LIST_BOOKINGS', params: {} },
  }),
  generateText: vi.fn().mockResolvedValue({ text: 'test' }),
}))

vi.mock('../src/db/repos/rezerwacje.js', () => ({
  listTodayRezerwacje: vi.fn().mockResolvedValue([
    { id: 'r1', data_wizyty: '2026-05-29', godzina_rozpoczecia: '10:00', calendar_event_id: 'ev1', status: 'potwierdzona' },
    { id: 'r2', data_wizyty: '2026-05-29', godzina_rozpoczecia: '14:00', calendar_event_id: 'ev2', status: 'potwierdzona' },
  ]),
  listRezerwacjeByDate: vi.fn().mockResolvedValue([]),
  createRezerwacja: vi.fn(),
}))

vi.mock('../src/db/repos/pracownicy.js', () => ({
  listPracownicy: vi.fn().mockResolvedValue([]),
  findPracownikForUsluga: vi.fn().mockResolvedValue(null),
  createPracownik: vi.fn().mockResolvedValue({ id: 'p1', Imie_Nazwisko: 'Test', email: 'test@test.com', calendar_id: '' }),
  deactivatePracownik: vi.fn().mockResolvedValue(undefined),
  findPracownikByName: vi.fn().mockResolvedValue({ id: 'p1', Imie_Nazwisko: 'Anna Kowalska', email: 'anna@test.com', calendar_id: '' }),
}))

vi.mock('../src/db/repos/uslugi.js', () => ({
  listUslugi: vi.fn().mockResolvedValue([]),
  findUsluga: vi.fn().mockResolvedValue({ id: 'u1', Nazwa: 'Manicure hybrydowy', cena: 110, czas_trwania_min: 60 }),
  updateCenaUslugi: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/db/repos/eskalacje.js', () => ({
  findEskalacjaByNumber: vi.fn().mockResolvedValue({ id: 'e1', Numer: 1, pytanie: 'test?', status: 'otwarta' }),
  closeEskalacja: vi.fn().mockResolvedValue(undefined),
  getSubscriberIdForEskalacja: vi.fn().mockResolvedValue('99999'),
  getNextEskalacjaNumber: vi.fn().mockResolvedValue(1),
  createEskalacja: vi.fn().mockResolvedValue({ id: 'e1', Numer: 1, pytanie: 'test', status: 'otwarta' }),
}))

vi.mock('../src/integrations/telegram.js', () => ({
  sendMessage: vi.fn().mockResolvedValue(true),
  setWebhook: vi.fn().mockResolvedValue(true),
}))

const testRouteResult = {
  salon: {
    id: 'recavm4YdbC3SaZw7',
    Nazwa: 'Bella Beauty Warszawa',
    system_prompt: 'test',
    owner_telegram_id: '8731593494',
    godziny_otwarcia: '9:00-18:00',
    manychat_api_key: '',
    owner_subscriber_id: '',
  },
  isOwner: true,
  message: {
    channel: 'telegram' as const,
    chatId: '8731593494',
    subscriberId: '8731593494',
    fullName: 'Właścicielka',
    text: 'dzisiejsze rezerwacje',
    rawUpdate: {} as any,
  },
}

describe('admin commands', () => {
  it('LIST_BOOKINGS returns formatted list', async () => {
    const { processAdmin } = await import('../src/core/admin.js')
    const result = await processAdmin(testRouteResult)
    expect(result).toContain('10:00')
    expect(result).toContain('14:00')
  })

  it('ADD_STAFF creates pracownik', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { command: 'ADD_STAFF', params: { name: 'Anna Kowalska', email: 'anna@test.com' } },
    } as any)
    const { processAdmin } = await import('../src/core/admin.js')
    const result = await processAdmin({ ...testRouteResult, message: { ...testRouteResult.message, text: 'dodaj pracownika Anna Kowalska anna@test.com' } })
    expect(result).toContain('Dodano pracownika')
    expect(result).toContain('Anna Kowalska')
  })

  it('REMOVE_STAFF deactivates pracownik', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { command: 'REMOVE_STAFF', params: { name: 'Anna Kowalska' } },
    } as any)
    const { processAdmin } = await import('../src/core/admin.js')
    const result = await processAdmin({ ...testRouteResult, message: { ...testRouteResult.message, text: 'usuń pracownika Anna Kowalska' } })
    expect(result).toContain('dezaktywowany')
  })

  it('UPDATE_PRICE updates service price', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { command: 'UPDATE_PRICE', params: { service_name: 'Manicure hybrydowy', price: 130 } },
    } as any)
    const { processAdmin } = await import('../src/core/admin.js')
    const result = await processAdmin({ ...testRouteResult, message: { ...testRouteResult.message, text: 'zmień cenę manicure na 130' } })
    expect(result).toContain('130 PLN')
  })

  it('ESCALATION_REPLY closes escalation and notifies client', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { command: 'ESCALATION_REPLY', params: { escalation_number: 1, reply_text: 'Tak, mamy zniżki 10%' } },
    } as any)
    const { processAdmin } = await import('../src/core/admin.js')
    const result = await processAdmin({ ...testRouteResult, message: { ...testRouteResult.message, text: 'odpowiedz 1 Tak, mamy zniżki 10%' } })
    expect(result).toContain('zamknięta')
  })

  it('UNKNOWN returns help message', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { command: 'UNKNOWN', params: {} },
    } as any)
    const { processAdmin } = await import('../src/core/admin.js')
    const result = await processAdmin({ ...testRouteResult, message: { ...testRouteResult.message, text: 'coś niezrozumiałego' } })
    expect(result).toContain('Nie rozumiem')
  })

  it('LIST_SERVICES returns formatted service list', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { command: 'LIST_SERVICES', params: {} },
    } as any)
    const { listUslugi } = await import('../src/db/repos/uslugi.js')
    vi.mocked(listUslugi).mockResolvedValueOnce([
      { id: 'u1', Nazwa: 'Manicure hybrydowy', cena: 110, czas_trwania_min: 60 },
      { id: 'u2', Nazwa: 'Pedicure', cena: 90, czas_trwania_min: 45 },
    ])
    const { processAdmin } = await import('../src/core/admin.js')
    const result = await processAdmin(testRouteResult)
    expect(result).toContain('Manicure hybrydowy')
    expect(result).toContain('PLN')
  })

  it('LIST_STAFF returns formatted staff list', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { command: 'LIST_STAFF', params: {} },
    } as any)
    const { listPracownicy } = await import('../src/db/repos/pracownicy.js')
    vi.mocked(listPracownicy).mockResolvedValueOnce([
      { id: 'p1', Imie_Nazwisko: 'Anna Kowalska', email: 'anna@test.com', calendar_id: '' },
    ])
    const { processAdmin } = await import('../src/core/admin.js')
    const result = await processAdmin(testRouteResult)
    expect(result).toContain('Anna Kowalska')
    expect(result).toContain('@')
  })

  it('LIST_UPCOMING returns reservations for date range', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { command: 'LIST_UPCOMING', params: { date_range: 'jutro' } },
    } as any)
    const { listRezerwacjeByDate } = await import('../src/db/repos/rezerwacje.js')
    vi.mocked(listRezerwacjeByDate as any).mockResolvedValueOnce([
      { id: 'r1', data_wizyty: '2026-06-01', godzina_rozpoczecia: '10:00', calendar_event_id: 'ev1', status: 'potwierdzona' },
    ])
    const { processAdmin } = await import('../src/core/admin.js')
    const result = await processAdmin(testRouteResult)
    expect(result).toContain('2026-06-01')
    expect(result).toContain('10:00')
  })
})
