import { OpenRouter } from '@openrouter/sdk'
import type { LLMProvider } from './provider'
import type { LLMResponse, LLMStreamChunk } from '@/types'
import { buildRAGPrompt, RAGBOX_SYSTEM_PROMPT } from './provider'

/**
 * OpenRouter LLM Provider (using official SDK)
 *
 * Used for development. Provides access to multiple models
 * through a single API.
 *
 * Default model: meta-llama/llama-3.3-70b-instruct
 * This aligns with our production sovereign stack (Llama 3.3)
 *
 * Note: In production, this will be swapped for VertexLlamaProvider
 */
export class OpenRouterProvider implements LLMProvider {
  private client: OpenRouter
  readonly model: string
  readonly name = 'openrouter'

  constructor(apiKey: string, model: string = 'meta-llama/llama-3.3-70b-instruct') {
    if (!apiKey) {
      throw new Error('OpenRouter API key is required')
    }
    this.client = new OpenRouter({ apiKey })
    this.model = model
  }

  async generate(
    prompt: string,
    context: string[],
    systemPrompt: string = RAGBOX_SYSTEM_PROMPT
  ): Promise<LLMResponse> {
    // Use chat.send() as per OpenRouter SDK docs
    const response = await this.client.chat.send({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildRAGPrompt(prompt, context) },
      ],
      maxTokens: 2048,
      temperature: 0.3, // Lower temperature for factual, consistent responses
    })

    // Handle non-streaming response - cast to expected shape
    type ChatResponse = {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number }
      model?: string
    }
    const typedResponse = response as ChatResponse
    const choice = typedResponse.choices?.[0]
    const content = choice?.message?.content || ''

    return {
      text: content,
      usage: {
        input_tokens: typedResponse.usage?.prompt_tokens || 0,
        output_tokens: typedResponse.usage?.completion_tokens || 0,
      },
      model: typedResponse.model || this.model,
    }
  }

  async *stream(
    prompt: string,
    context: string[],
    systemPrompt: string = RAGBOX_SYSTEM_PROMPT
  ): AsyncIterable<LLMStreamChunk> {
    // Use chat.send() with stream: true as per OpenRouter SDK docs
    const stream = await this.client.chat.send({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildRAGPrompt(prompt, context) },
      ],
      maxTokens: 2048,
      temperature: 0.3,
      stream: true,
    })

    // Handle streaming response
    for await (const chunk of stream as AsyncIterable<{ choices?: { delta?: { content?: string }, finish_reason?: string }[] }>) {
      const content = chunk.choices?.[0]?.delta?.content
      const finishReason = chunk.choices?.[0]?.finish_reason

      if (content) {
        yield { text: content, done: false }
      }

      if (finishReason) {
        yield { text: '', done: true }
      }
    }
  }
}
