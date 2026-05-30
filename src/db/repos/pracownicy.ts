import { base } from '../airtable.js'

export interface Pracownik {
  id: string
  Imie_Nazwisko: string
  email: string
  calendar_id: string
}

export async function listPracownicy(salonNazwa: string): Promise<Pracownik[]> {
  const records = await base('Pracownicy')
    .select({
      filterByFormula: `AND({aktywny}=TRUE(), FIND('${salonNazwa}', ARRAYJOIN({Salon})))`,
    })
    .all()

  return records.map(r => ({
    id: r.id,
    Imie_Nazwisko: (r.get('Imie_Nazwisko') as string) || '',
    email: (r.get('email') as string) || '',
    calendar_id: (r.get('calendar_id') as string) || '',
  }))
}

export async function findPracownikForUsluga(
  salonNazwa: string,
  uslugaNazwa: string
): Promise<Pracownik | null> {
  const records = await base('Pracownicy')
    .select({
      filterByFormula: `AND(FIND('${uslugaNazwa}', ARRAYJOIN({Uslugi})), {aktywny}=TRUE(), FIND('${salonNazwa}', ARRAYJOIN({Salon})))`,
      maxRecords: 1,
    })
    .all()

  if (records.length === 0) return null

  const r = records[0]
  return {
    id: r.id,
    Imie_Nazwisko: (r.get('Imie_Nazwisko') as string) || '',
    email: (r.get('email') as string) || '',
    calendar_id: (r.get('calendar_id') as string) || '',
  }
}

export async function createPracownik(params: {
  imieNazwisko: string
  email: string
  salonId: string
}): Promise<Pracownik> {
  const record = await base('Pracownicy').create({
    Imie_Nazwisko: params.imieNazwisko,
    email: params.email,
    aktywny: true,
    Salon: [params.salonId],
  })
  return {
    id: record.id,
    Imie_Nazwisko: params.imieNazwisko,
    email: params.email,
    calendar_id: params.email,
  }
}

export async function deactivatePracownik(id: string): Promise<void> {
  await base('Pracownicy').update(id, {
    fldEZrUf17XdDdURc: false,
  })
}

export async function findPracownikByName(
  salonNazwa: string,
  imieNazwisko: string
): Promise<Pracownik | null> {
  const records = await base('Pracownicy')
    .select({
      filterByFormula: `AND({Imie_Nazwisko}='${imieNazwisko}', FIND('${salonNazwa}', ARRAYJOIN({Salon})))`,
      maxRecords: 1,
    })
    .all()
  if (records.length === 0) return null
  return {
    id: records[0].id,
    Imie_Nazwisko: (records[0].get('Imie_Nazwisko') as string) || '',
    email: (records[0].get('email') as string) || '',
    calendar_id: (records[0].get('calendar_id') as string) || (records[0].get('email') as string) || '',
  }
}
