import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/integrations/googleCalendar.js', () => ({
  getFreeBusy: vi.fn().mockResolvedValue([
    { start: '2026-05-29T08:00:00.000Z', end: '2026-05-29T09:00:00.000Z' },
  ]),
  createCalendarEvent: vi.fn().mockResolvedValue('event-id-123'),
}))

vi.mock('../src/db/repos/rezerwacje.js', () => ({
  createRezerwacja: vi.fn().mockResolvedValue({
    id: 'recRez1',
    data_wizyty: '2026-05-30',
    godzina_rozpoczecia: '10:00',
    calendar_event_id: 'event-id-123',
    status: 'potwierdzona',
  }),
  listTodayRezerwacje: vi.fn().mockResolvedValue([]),
}))

vi.mock('../src/db/repos/uslugi.js', () => ({
  findUsluga: vi.fn().mockResolvedValue({
    id: 'recUsluga1',
    Nazwa: 'Manicure hybrydowy',
    cena: 110,
    czas_trwania_min: 60,
  }),
  listUslugi: vi.fn().mockResolvedValue([]),
}))

vi.mock('../src/db/repos/pracownicy.js', () => ({
  findPracownikForUsluga: vi.fn().mockResolvedValue({
    id: 'recPracownik1',
    Imie_Nazwisko: 'Marta Wiśniewska',
    email: 'marta@test.com',
    calendar_id: 'marta@test.com',
  }),
  listPracownicy: vi.fn().mockResolvedValue([]),
}))

const testSalon = {
  id: 'recavm4YdbC3SaZw7',
  Nazwa: 'Bella Beauty Warszawa',
  system_prompt: 'test',
  owner_telegram_id: '8731593494',
  godziny_otwarcia: '9:00-18:00',
  manychat_api_key: '',
  owner_subscriber_id: '',
}

describe('booking — free slots', () => {
  it('returns available slots excluding busy times', async () => {
    const { processBooking } = await import('../src/core/booking.js')
    const result = await processBooking({
      salon: testSalon,
      serviceName: 'Manicure hybrydowy',
      preferredDay: '2026-05-29',
      clientId: 'recKlient1',
      conversationId: 'recKonw1',
      subscriberId: '99999',
    })

    expect(result.responseText).toContain('Manicure hybrydowy')
    expect(result.responseText).toContain('2026-05-29')
    expect(result.availableSlots).toBeDefined()
    expect(result.availableSlots!.length).toBeGreaterThan(0)
    expect(result.availableSlots!).not.toContain('08:00')
  })

  it('returns no slots message when calendar is full', async () => {
    const { getFreeBusy } = await import('../src/integrations/googleCalendar.js')
    vi.mocked(getFreeBusy).mockResolvedValueOnce(
      Array.from({ length: 24 }, (_, i) => ({
        start: `2026-05-29T${String(i).padStart(2, '0')}:00:00Z`,
        end: `2026-05-29T${String(i + 1).padStart(2, '0')}:00:00Z`,
      }))
    )

    const { processBooking } = await import('../src/core/booking.js')
    const result = await processBooking({
      salon: testSalon,
      serviceName: 'Manicure hybrydowy',
      preferredDay: '2026-05-29',
      clientId: 'recKlient1',
      conversationId: 'recKonw1',
      subscriberId: '99999',
    })

    expect(result.responseText).toContain('nie mamy wolnych terminów')
    expect(result.availableSlots).toBeUndefined()
  })

  it('returns error when service not found', async () => {
    const { findUsluga } = await import('../src/db/repos/uslugi.js')
    vi.mocked(findUsluga).mockResolvedValueOnce(null)

    const { processBooking } = await import('../src/core/booking.js')
    const result = await processBooking({
      salon: testSalon,
      serviceName: 'Nieistniejąca usługa',
      preferredDay: '2026-05-29',
      clientId: 'recKlient1',
      conversationId: 'recKonw1',
      subscriberId: '99999',
    })

    expect(result.responseText).toContain('nie znalazłam usługi')
  })
})

describe('booking — CONFIRM', () => {
  it('creates calendar event and rezerwacja when slot is available', async () => {
    const { getFreeBusy, createCalendarEvent } = await import('../src/integrations/googleCalendar.js')
    vi.mocked(getFreeBusy).mockResolvedValueOnce([])

    const { processConfirm } = await import('../src/core/booking.js')
    const result = await processConfirm({
      salon: testSalon,
      serviceName: 'Manicure hybrydowy',
      preferredDay: '2026-05-30',
      preferredTime: '10:00',
      clientId: 'recKlient1',
      conversationId: 'recKonw1',
      subscriberId: '99999',
    })

    expect(result.responseText).toContain('Rezerwacja potwierdzona')
    expect(result.responseText).toContain('10:00')
    expect(createCalendarEvent).toHaveBeenCalledWith(
      'marta@test.com',
      expect.stringContaining('Manicure hybrydowy'),
      '2026-05-30',
      '10:00',
      60
    )
  })

  it('rejects unavailable slot', async () => {
    const { getFreeBusy } = await import('../src/integrations/googleCalendar.js')
    vi.mocked(getFreeBusy).mockResolvedValueOnce(
      Array.from({ length: 24 }, (_, i) => ({
        start: `2026-05-30T${String(i).padStart(2, '0')}:00:00Z`,
        end: `2026-05-30T${String(i + 1).padStart(2, '0')}:00:00Z`,
      }))
    )

    const { processConfirm } = await import('../src/core/booking.js')
    const result = await processConfirm({
      salon: testSalon,
      serviceName: 'Manicure hybrydowy',
      preferredDay: '2026-05-30',
      preferredTime: '10:00',
      clientId: 'recKlient1',
      conversationId: 'recKonw1',
      subscriberId: '99999',
    })

    expect(result.responseText).toContain('nie jest już dostępny')
  })

  it('returns error when service not found on confirm', async () => {
    const { findUsluga } = await import('../src/db/repos/uslugi.js')
    vi.mocked(findUsluga).mockResolvedValueOnce(null)

    const { processConfirm } = await import('../src/core/booking.js')
    const result = await processConfirm({
      salon: testSalon,
      serviceName: 'Nieistniejąca',
      preferredDay: '2026-05-30',
      preferredTime: '10:00',
      clientId: 'recKlient1',
      conversationId: 'recKonw1',
      subscriberId: '99999',
    })

    expect(result.responseText).toContain('nie mogłam znaleźć usługi')
  })
})
