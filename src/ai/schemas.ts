import { z } from 'zod'

export const BrainOutputSchema = z.object({
  intent: z.enum(['INFO', 'BOOKING', 'CONFIRM', 'UNKNOWN']),
  service_name: z.string().nullable().optional().describe('Nazwa usługi (przy BOOKING)'),
  preferred_day: z.string().nullable().optional().describe('Data w formacie YYYY-MM-DD (przy BOOKING)'),
  preferred_time: z.string().nullable().optional().describe('Godzina w formacie HH:MM (przy CONFIRM)'),
  response_text: z.string().describe('Odpowiedź do wysłania klientce'),
})

export type BrainOutput = z.infer<typeof BrainOutputSchema>

export const AdminCommandSchema = z.object({
  command: z.enum([
    'ADD_STAFF',
    'REMOVE_STAFF',
    'UPDATE_PRICE',
    'LIST_BOOKINGS',
    'LIST_SERVICES',
    'LIST_STAFF',
    'LIST_UPCOMING',
    'ESCALATION_REPLY',
    'UNKNOWN',
  ]),
  params: z.object({
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    service_name: z.string().nullable().optional(),
    price: z.number().nullable().optional(),
    escalation_number: z.number().nullable().optional(),
    reply_text: z.string().nullable().optional(),
    date_range: z.string().nullable().optional(),
  }),
})

export type AdminCommand = z.infer<typeof AdminCommandSchema>
