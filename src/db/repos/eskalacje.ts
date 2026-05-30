import { base } from '../airtable.js'
import { logger } from '../../lib/logger.js'

export interface Eskalacja {
  id: string
  Numer: number
  pytanie: string
  status: string
}

export async function getNextEskalacjaNumber(): Promise<number> {
  const records = await base('Eskalacje')
    .select({
      sort: [{ field: 'Numer', direction: 'desc' }],
      maxRecords: 1,
      fields: ['Numer'],
    })
    .all()

  if (records.length === 0) return 1
  const lastNum = (records[0].get('Numer') as number) || 0
  return lastNum + 1
}

export async function createEskalacja(
  pytanie: string,
  konwersacjaId: string
): Promise<Eskalacja> {
  const numer = await getNextEskalacjaNumber()
  const record = await base('Eskalacje').create({
    fldYnS9MZHhzmmnFz: numer,
    fldE8YZvhSb7FOw0K: pytanie,
    fld5vev6LH8jrx4ak: 'otwarta',
    fldRwYmA3N54Ua6Hl: new Date().toISOString(),
    fldePBtO1lpwn7E16: [konwersacjaId],
  })
  logger.info({ numer, id: record.id }, 'Eskalacja created')
  return {
    id: record.id,
    Numer: numer,
    pytanie,
    status: 'otwarta',
  }
}

export async function findEskalacjaByNumber(numer: number): Promise<Eskalacja | null> {
  const records = await base('Eskalacje')
    .select({
      filterByFormula: `{Numer}=${numer}`,
      maxRecords: 1,
    })
    .all()

  if (records.length === 0) return null
  return {
    id: records[0].id,
    Numer: records[0].get('Numer') as number,
    pytanie: (records[0].get('pytanie') as string) || '',
    status: (records[0].get('status') as string) || '',
  }
}

export async function closeEskalacja(id: string, odpowiedz: string): Promise<void> {
  await base('Eskalacje').update(id, {
    fldut6Gg9lsiLpA3J: odpowiedz,
    fld5vev6LH8jrx4ak: 'zamknieta',
  })
}

export async function getSubscriberIdForEskalacja(eskalacjaId: string): Promise<string | null> {
  try {
    const eskRecord = await base('Eskalacje').find(eskalacjaId)
    const konwersacjaIds = eskRecord.get('Konwersacja') as string[] | undefined
    if (!konwersacjaIds || konwersacjaIds.length === 0) return null

    const konwRecord = await base('Konwersacje').find(konwersacjaIds[0])
    const klientIds = konwRecord.get('Klient') as string[] | undefined
    if (!klientIds || klientIds.length === 0) return null

    const klientRecord = await base('Klienci').find(klientIds[0])
    return (klientRecord.get('manychat_subscriber_id') as string) || null
  } catch (err) {
    return null
  }
}
