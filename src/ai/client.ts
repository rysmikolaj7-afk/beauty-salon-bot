import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { config } from '../config.js'

export const openai = createOpenAI({ apiKey: config.OPENAI_API_KEY })

export const AI_MODEL = 'gpt-4o-mini'

export async function testAIConnection(): Promise<string> {
  const { text } = await generateText({
    model: openai(AI_MODEL),
    prompt: 'Odpowiedz jednym słowem po polsku: jak masz na imię?',
    maxTokens: 10,
  })
  return text
}
