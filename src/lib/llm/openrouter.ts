import type { LLMProvider } from './provider'
import type { LLMResponse, LLMStreamChunk } from '@/types'
import { buildRAGPrompt, RAGBOX_SYSTEM_PROMPT } from './provider'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenRouterResponse {
  id: string
  choices: {
    message: {
      content: string
      role: string
    }
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  model: string
}

interface OpenRouterStreamChunk {
  id: string
  choices: {
    delta: {
      content?: string
    }
    finish_reason: string | null
  }[]
}

/**
 * OpenRouter LLM Provider
 *
 * Used for development. Provides access to multiple models
 * through a single API (Claude, GPT-4, Llama, etc.)
 *
 * Note: In production, this will be swapped for VertexLlamaProvider
 */
export class OpenRouterProvider implements LLMProvider {
  private apiKey: string
  readonly model: string
  readonly name = 'openrouter'

  constructor(apiKey: string, model: string = 'anthropic/claude-3.5-sonnet') {
    if (!apiKey) {
      throw new Error('OpenRouter API key is required')
    }
    this.apiKey = apiKey
    this.model = model
  }

  async generate(
    prompt: string,
    context: string[],
    systemPrompt: string = RAGBOX_SYSTEM_PROMPT
  ): Promise<LLMResponse> {
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildRAGPrompt(prompt, context) },
    ]

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'RAGbox',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: 2048,
        temperature: 0.3, // Lower temperature for more consistent, factual responses
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
    }

    const data: OpenRouterResponse = await response.json()
    const choice = data.choices[0]

    return {
      text: choice.message.content,
      usage: {
        input_tokens: data.usage.prompt_tokens,
        output_tokens: data.usage.completion_tokens,
      },
      model: data.model,
    }
  }

  async *stream(
    prompt: string,
    context: string[],
    systemPrompt: string = RAGBOX_SYSTEM_PROMPT
  ): AsyncIterable<LLMStreamChunk> {
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildRAGPrompt(prompt, context) },
    ]

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'RAGbox',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: 2048,
        temperature: 0.3,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json: OpenRouterStreamChunk = JSON.parse(trimmed.slice(6))
            const content = json.choices[0]?.delta?.content
            const isDone = json.choices[0]?.finish_reason !== null

            if (content) {
              yield { text: content, done: false }
            }
            if (isDone) {
              yield { text: '', done: true }
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
