import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const MODELS = {
  RANK: 'claude-haiku-4-5-20251001',    // ~$0.002/call — scoring
  GENERATE: 'claude-sonnet-4-6',         // ~$0.045/call — resume generation
} as const

export async function callAnthropic(opts: {
  model: string
  system: string
  prompt: string
  maxTokens?: number
}): Promise<string> {
  const msg = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: [{ role: 'user', content: opts.prompt }],
  })

  const textBlock = msg.content.find(b => b.type === 'text')
  return textBlock?.text ?? ''
}

export { client }
