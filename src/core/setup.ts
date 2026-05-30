import { base } from '../db/airtable.js'
import { logger } from '../lib/logger.js'
import { sendMessage as sendTelegramMessage } from '../integrations/telegram.js'

export interface SetupPayload {
  salon_name: string
  manychat_page_id: string
  owner_subscriber_id: string
  owner_telegram_id?: string
  manychat_api_key: string
  godziny_otwarcia: string
  system_prompt?: string
  uslugi: Array<{
    nazwa: string
    cena: number
    czas_trwania_min: number
  }>
  pracownicy: Array<{
    imie_nazwisko: string
    email: string
  }>
}

export async function processSetup(
  payload: SetupPayload
): Promise<{ success: boolean; message: string }> {
  try {
    logger.info({ salonName: payload.salon_name }, 'Setup: creating new salon')

    const defaultPrompt = `Jesteś AI-recepcjonistką salonu ${payload.salon_name}. Jesteś pomocna, profesjonalna i uprzejma. Odpowiadaj po polsku.`

    const salonRecord = await base('Salony').create({
      Nazwa: payload.salon_name,
      manychat_page_id: payload.manychat_page_id,
      owner_subscriber_id: payload.owner_subscriber_id,
      ...(payload.owner_telegram_id ? { owner_telegram_id: payload.owner_telegram_id } : {}),
      manychat_api_key: payload.manychat_api_key,
      godziny_otwarcia: payload.godziny_otwarcia,
      system_prompt: payload.system_prompt || defaultPrompt,
      status: 'aktywny',
    })

    const salonId = salonRecord.id
    logger.info({ salonId }, 'Setup: salon created')

    for (const u of payload.uslugi) {
      await base('Uslugi').create({
        Nazwa: u.nazwa,
        cena: u.cena,
        czas_trwania_min: u.czas_trwania_min,
        aktywna: true,
        Salon: [salonId],
      })
    }
    logger.info({ count: payload.uslugi.length }, 'Setup: services created')

    for (const p of payload.pracownicy) {
      await base('Pracownicy').create({
        Imie_Nazwisko: p.imie_nazwisko,
        email: p.email,
        calendar_id: p.email,
        aktywny: true,
        Salon: [salonId],
      })
    }
    logger.info({ count: payload.pracownicy.length }, 'Setup: staff created')

    if (payload.owner_telegram_id) {
      await sendTelegramMessage(
        payload.owner_telegram_id,
        `Salon "${payload.salon_name}" został skonfigurowany!\n\nDostępne komendy:\n• "dzisiejsze rezerwacje"\n• "dodaj pracownika [imię] [email]"\n• "usuń pracownika [imię]"\n• "zmień cenę [usługa] na [kwota]"\n• "odpowiedz [numer] [treść]"`
      )
    }

    return {
      success: true,
      message: `Salon "${payload.salon_name}" skonfigurowany pomyślnie. Utworzono ${payload.uslugi.length} usług i ${payload.pracownicy.length} pracowników.`,
    }
  } catch (err) {
    logger.error({ err }, 'Setup failed')
    return { success: false, message: 'Błąd podczas konfiguracji salonu.' }
  }
}
