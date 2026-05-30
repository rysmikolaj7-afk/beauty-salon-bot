import Airtable from 'airtable'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'

Airtable.configure({ apiKey: config.AIRTABLE_API_KEY })
export const base = new Airtable().base(config.AIRTABLE_BASE_ID)

export interface Salon {
  id: string
  Nazwa: string
  system_prompt: string
  manychat_api_key: string
  owner_subscriber_id: string
  owner_telegram_id?: string
  godziny_otwarcia: string
  manychat_page_id?: string
}

const salonCache = new Map<string, { data: Salon; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function getSalon(salonId: string): Promise<Salon | null> {
  const cached = salonCache.get(salonId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  try {
    const record = await base('Salony').find(salonId)
    const salon: Salon = {
      id: record.id,
      Nazwa: record.get('Nazwa') as string || '',
      system_prompt: record.get('system_prompt') as string || '',
      manychat_api_key: record.get('manychat_api_key') as string || '',
      owner_subscriber_id: record.get('owner_subscriber_id') as string || '',
      owner_telegram_id: record.get('owner_telegram_id') as string || undefined,
      godziny_otwarcia: record.get('godziny_otwarcia') as string || '',
      manychat_page_id: record.get('manychat_page_id') as string || undefined,
    }
    salonCache.set(salonId, { data: salon, expiresAt: Date.now() + CACHE_TTL_MS })
    logger.debug({ salonId, name: salon.Nazwa }, 'Salon loaded from Airtable')
    return salon
  } catch (err) {
    logger.error({ salonId, err }, 'Failed to fetch salon from Airtable')
    return null
  }
}

export async function findSalonByPageId(pageId: string): Promise<Salon | null> {
  // Sanitize: ManyChat page IDs are always numeric; reject anything else
  // to prevent formula injection via crafted page_id values
  if (!/^\d+$/.test(pageId)) {
    logger.warn({ pageId }, 'findSalonByPageId: invalid non-numeric pageId rejected')
    return null
  }
  try {
    const records = await base('Salony')
      .select({
        filterByFormula: `{manychat_page_id}='${pageId}'`,
        maxRecords: 1,
      })
      .all()
    if (records.length === 0) return null
    const r = records[0]
    return {
      id: r.id,
      Nazwa: (r.get('Nazwa') as string) || '',
      system_prompt: (r.get('system_prompt') as string) || '',
      manychat_api_key: (r.get('manychat_api_key') as string) || '',
      owner_subscriber_id: (r.get('owner_subscriber_id') as string) || '',
      owner_telegram_id: (r.get('owner_telegram_id') as string) || undefined,
      godziny_otwarcia: (r.get('godziny_otwarcia') as string) || '',
      manychat_page_id: (r.get('manychat_page_id') as string) || undefined,
    }
  } catch (err) {
    logger.error({ pageId, err }, 'Failed to find salon by page_id')
    return null
  }
}
