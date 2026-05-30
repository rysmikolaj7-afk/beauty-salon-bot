import { base } from '../airtable.js'
import { logger } from '../../lib/logger.js'

export interface Klient {
  id: string
  Imie_Nazwisko: string
  notatki: string
}

export async function findOrCreateKlient(
  subscriberId: string,
  fullName: string,
  salonId: string,
  salonNazwa: string
): Promise<Klient> {
  const records = await base('Klienci')
    .select({
      filterByFormula: `AND({manychat_subscriber_id}='${subscriberId}', FIND('${salonNazwa}', ARRAYJOIN({Salon})))`,
      maxRecords: 1,
    })
    .all()

  if (records.length > 0) {
    const r = records[0]
    logger.debug({ subscriberId, salonNazwa }, 'Klient found')
    return {
      id: r.id,
      Imie_Nazwisko: (r.get('Imie_Nazwisko') as string) || '',
      notatki: (r.get('notatki') as string) || '',
    }
  }

  logger.debug({ subscriberId, salonNazwa }, 'Klient not found — creating')
  const created = await base('Klienci').create({
    Imie_Nazwisko: fullName,
    manychat_subscriber_id: subscriberId,
    Salon: [salonId],
  })

  return {
    id: created.id,
    Imie_Nazwisko: (created.get('Imie_Nazwisko') as string) || fullName,
    notatki: '',
  }
}
