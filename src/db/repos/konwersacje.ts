import { base } from '../airtable.js'
import { logger } from '../../lib/logger.js'

export interface Konwersacja {
  id: string
  ID_Konwersacji: string
}

export async function findOrCreateKonwersacja(
  klientId: string,
  klientNazwa: string,
  salonId: string
): Promise<Konwersacja> {
  const records = await base('Konwersacje')
    .select({
      filterByFormula: `AND(FIND('${klientNazwa}', ARRAYJOIN({Klient})), {status}='otwarta')`,
      maxRecords: 1,
    })
    .all()

  if (records.length > 0) {
    const r = records[0]
    logger.debug({ klientNazwa }, 'Konwersacja found')
    return {
      id: r.id,
      ID_Konwersacji: (r.get('ID_Konwersacji') as string) || '',
    }
  }

  const convId = `CONV-${Date.now()}`
  logger.debug({ klientNazwa, convId }, 'Konwersacja not found — creating')

  const created = await base('Konwersacje').create({
    ID_Konwersacji: convId,
    Klient: [klientId],
    Salon: [salonId],
    status: 'otwarta',
  })

  return {
    id: created.id,
    ID_Konwersacji: (created.get('ID_Konwersacji') as string) || convId,
  }
}
