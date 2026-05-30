import { getFreeBusy } from '../integrations/googleCalendar.js'

const today = new Date().toISOString().split('T')[0]
console.log(`\nTesting Google Calendar FreeBusy for ${today}...`)

const busy = await getFreeBusy('mikirys3333@gmail.com', today)
console.log(`✅ Google Calendar OK — zajęte sloty dziś: ${busy.length}`)
if (busy.length > 0) {
  busy.forEach(b => console.log(`  ${b.start} → ${b.end}`))
}
