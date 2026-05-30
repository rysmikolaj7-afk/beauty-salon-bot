import { describe, it, expect } from 'vitest'
import { parseManyChatWebhook, getManyChatPageId } from '../src/channels/manychat.js'

describe('ManyChat channel parser', () => {
  it('parses valid ManyChat payload', () => {
    const payload = {
      page_id: '123456789',
      subscriber_id: 'sub_abc123',
      full_name: 'Anna Kowalska',
      last_input_text: 'ile kosztuje manicure?',
    }
    const msg = parseManyChatWebhook(payload)
    expect(msg).not.toBeNull()
    expect(msg!.channel).toBe('manychat')
    expect(msg!.subscriberId).toBe('sub_abc123')
    expect(msg!.text).toBe('ile kosztuje manicure?')
    expect(msg!.fullName).toBe('Anna Kowalska')
  })

  it('returns null for missing required fields', () => {
    expect(parseManyChatWebhook({})).toBeNull()
    expect(parseManyChatWebhook({ page_id: '123' })).toBeNull()
    expect(parseManyChatWebhook(null)).toBeNull()
  })

  it('extracts page_id correctly', () => {
    const payload = { page_id: '987654321', subscriber_id: 'sub1', last_input_text: 'test' }
    expect(getManyChatPageId(payload)).toBe('987654321')
    expect(getManyChatPageId({})).toBeNull()
  })
})
