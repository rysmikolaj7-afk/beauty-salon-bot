import { describe, it, expect } from 'vitest'

describe('config', () => {
  it('should export config object', async () => {
    const { config } = await import('../src/config.js')
    expect(config.AIRTABLE_BASE_ID).toBe('appAvG7OyXDuSBhzP')
    expect(config.PORT).toBeTypeOf('number')
  })
})
