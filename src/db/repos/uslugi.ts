import { base } from '../airtable.js'

export interface Usluga {
  id: string
  Nazwa: string
  cena: number
  czas_trwania_min: number
}

export async function listUslugi(salonNazwa: string): Promise<Usluga[]> {
  const records = await base('Uslugi')
    .select({
      filterByFormula: `AND({aktywna}=TRUE(), FIND('${salonNazwa}', ARRAYJOIN({Salon})))`,
    })
    .all()

  return records.map(r => ({
    id: r.id,
    Nazwa: (r.get('Nazwa') as string) || '',
    cena: (r.get('cena') as number) || 0,
    czas_trwania_min: (r.get('czas_trwania_min') as number) || 0,
  }))
}

export async function findUsluga(salonNazwa: string, nazwa: string): Promise<Usluga | null> {
  const records = await base('Uslugi')
    .select({
      filterByFormula: `AND({aktywna}=TRUE(), FIND('${salonNazwa}', ARRAYJOIN({Salon})), {Nazwa}='${nazwa}')`,
      maxRecords: 1,
    })
    .all()

  if (records.length === 0) return null

  const r = records[0]
  return {
    id: r.id,
    Nazwa: (r.get('Nazwa') as string) || '',
    cena: (r.get('cena') as number) || 0,
    czas_trwania_min: (r.get('czas_trwania_min') as number) || 0,
  }
}

export async function updateCenaUslugi(id: string, cena: number): Promise<void> {
  await base('Uslugi').update(id, {
    fldqCunyBeE1khcHk: cena,
  })
}
