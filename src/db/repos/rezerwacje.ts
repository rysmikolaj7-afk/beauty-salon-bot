import { base } from '../airtable.js'
import { logger } from '../../lib/logger.js'

export interface Rezerwacja {
  id: string
  data_wizyty: string
  godzina_rozpoczecia: string
  calendar_event_id: string
  status: string
}

export async function createRezerwacja(params: {
  salonId: string
  klientId: string
  pracownikId: string
  uslugaId: string
  dataWizyty: string
  godzinaRozpoczecia: string
  calendarEventId: string
}): Promise<Rezerwacja> {
  const record = await base('Rezerwacje').create({
    data_wizyty: params.dataWizyty,
    godzina_rozpoczecia: params.godzinaRozpoczecia,
    calendar_event_id: params.calendarEventId,
    status: 'potwierdzona',
    Klient: [params.klientId],
    ...(params.pracownikId ? { Pracownik: [params.pracownikId] } : {}),
    Usluga: [params.uslugaId],
    Salon: [params.salonId],
  })

  logger.info({
    id: record.id,
    data: params.dataWizyty,
    godzina: params.godzinaRozpoczecia,
  }, 'Rezerwacja created')

  return {
    id: record.id,
    data_wizyty: params.dataWizyty,
    godzina_rozpoczecia: params.godzinaRozpoczecia,
    calendar_event_id: params.calendarEventId,
    status: 'potwierdzona',
  }
}

export async function listTodayRezerwacje(salonNazwa: string): Promise<Rezerwacja[]> {
  const today = new Date().toISOString().split('T')[0]
  const records = await base('Rezerwacje')
    .select({
      filterByFormula: `AND({data_wizyty}='${today}', {status}='potwierdzona', FIND('${salonNazwa}', ARRAYJOIN({Salon})))`,
      sort: [{ field: 'godzina_rozpoczecia', direction: 'asc' }],
    })
    .all()

  return records.map(r => ({
    id: r.id,
    data_wizyty: (r.get('data_wizyty') as string) || '',
    godzina_rozpoczecia: (r.get('godzina_rozpoczecia') as string) || '',
    calendar_event_id: (r.get('calendar_event_id') as string) || '',
    status: (r.get('status') as string) || '',
  }))
}

export async function listRezerwacjeByDate(
  salonNazwa: string,
  dateFrom: string,
  dateTo: string
): Promise<Rezerwacja[]> {
  const records = await base('Rezerwacje')
    .select({
      filterByFormula: `AND({data_wizyty}>='${dateFrom}', {data_wizyty}<='${dateTo}', {status}='potwierdzona', FIND('${salonNazwa}', ARRAYJOIN({Salon})))`,
      sort: [
        { field: 'data_wizyty', direction: 'asc' },
        { field: 'godzina_rozpoczecia', direction: 'asc' },
      ],
    })
    .all()

  return records.map(r => ({
    id: r.id,
    data_wizyty: (r.get('data_wizyty') as string) || '',
    godzina_rozpoczecia: (r.get('godzina_rozpoczecia') as string) || '',
    calendar_event_id: (r.get('calendar_event_id') as string) || '',
    status: (r.get('status') as string) || '',
  }))
}
