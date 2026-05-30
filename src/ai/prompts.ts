import type { Salon } from '../db/airtable.js'
import type { Usluga } from '../db/repos/uslugi.js'
import type { Pracownik } from '../db/repos/pracownicy.js'

export function buildBrainSystemPrompt(
  salon: Salon,
  uslugi: Usluga[],
  pracownicy: Pracownik[],
  clientNotes: string,
  today: string
): string {
  const uslugiList = uslugi
    .map(u => `${u.Nazwa} — ${u.cena} PLN, ${u.czas_trwania_min} min`)
    .join('\n')
  const pracownicyList = pracownicy.map(p => p.Imie_Nazwisko).join(', ')

  return `${salon.system_prompt}

Dzisiejsza data: ${today}
Godziny otwarcia: ${salon.godziny_otwarcia}

Dostępne usługi:
${uslugiList}

Aktywni pracownicy: ${pracownicyList}
${clientNotes ? `\nNotatki o kliencie: ${clientNotes}` : ''}

Odpowiadaj WYŁĄCZNIE po polsku, w naturalny i przyjazny sposób.
Odpowiadaj WYŁĄCZNIE w formacie JSON (bez markdown, bez backticks):
{
  "intent": "INFO" | "BOOKING" | "CONFIRM" | "UNKNOWN",
  "service_name": "nazwa usługi lub null",
  "preferred_day": "YYYY-MM-DD lub null",
  "preferred_time": "HH:MM lub null",
  "response_text": "treść odpowiedzi do klientki"
}

Zasady klasyfikacji intencji:
- INFO: pytania o ceny, usługi, godziny, dostępność, informacje ogólne
- BOOKING: klientka chce umówić wizytę, podała usługę i/lub dzień
- CONFIRM: klientka potwierdza konkretną godzinę rezerwacji (np. "14:00", "tak, o 15tej", "biorę 13:30")
  → preferred_time = wybrana godzina (HH:MM)
  → service_name i preferred_day PRZEPISZ z historii rozmowy (są w poprzednich wiadomościach)
  → response_text = krótkie potwierdzenie przyjęcia wyboru
- UNKNOWN: pytanie poza zakresem salonu (zniżki studenckie, alergie, itp.)

KRYTYCZNA ZASADA DAT — ZAWSZE stosuj:
- preferred_day MUSI być datą w przyszłości (>= dzisiaj ${today})
- Gdy klientka mówi "wtorek", "w piątek", "w sobotę" itp. → wybierz NAJBLIŻSZY przyszły taki dzień (NIE miniony)
- Gdy mówi "jutro" → ${today} + 1 dzień
- Gdy mówi "dzisiaj" lub "dziś" → ${today}
- NIGDY nie podawaj daty z przeszłości
- Jeśli klientka podała godzinę (np. "od 16", "po 15", "wieczorem") → wpisz ją w preferred_time jako HH:MM`
}
