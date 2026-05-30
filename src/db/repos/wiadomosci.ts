import { base } from '../airtable.js'

export interface Wiadomosc {
  id: string
  tresc: string
  kierunek: string
  nadawca_typ: string
  timestamp: string
}

export async function getLastMessages(
  konwersacjaCode: string,
  limit: number
): Promise<Wiadomosc[]> {
  const records = await base('Wiadomosci')
    .select({
      filterByFormula: `FIND('${konwersacjaCode}', ARRAYJOIN({Konwersacja}))`,
      sort: [{ field: 'timestamp', direction: 'desc' }],
      maxRecords: limit,
    })
    .all()

  return records.map(r => ({
    id: r.id,
    tresc: (r.get('tresc') as string) || '',
    kierunek: (r.get('kierunek') as string) || '',
    nadawca_typ: (r.get('nadawca_typ') as string) || '',
    timestamp: (r.get('timestamp') as string) || '',
  }))
}

export async function createWiadomosc(
  tresc: string,
  kierunek: 'przychodzaca' | 'wychodzaca',
  nadawca_typ: 'klient' | 'wlasciciel' | 'ai',
  konwersacjaId: string
): Promise<void> {
  await base('Wiadomosci').create({
    tresc,
    kierunek,
    nadawca_typ,
    timestamp: new Date().toISOString(),
    Konwersacja: [konwersacjaId],
  })
}
