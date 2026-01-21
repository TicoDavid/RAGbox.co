import type { LLMProvider } from './provider'
import { OpenRouterProvider } from './openrouter'

export type { LLMProvider } from './provider'
export { RAGBOX_SYSTEM_PROMPT, buildRAGPrompt } from './provider'
export { OpenRouterProvider } from './openrouter'

/**
 * Get the configured LLM provider based on environment variables
 *
 * Development: OpenRouter
 * Production: Vertex AI (Llama 3.3 with Gemini fallback)
 *
 * @throws Error if required environment variables are missing
 */
export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || 'openrouter'

  switch (provider) {
    case 'openrouter': {
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY environment variable is required')
      }
      const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet'
      return new OpenRouterProvider(apiKey, model)
    }

    case 'vertex-llama': {
      // TODO: Implement VertexLlamaProvider for production
      // This will use Llama 3.3 70B hosted on Vertex AI
      throw new Error('Vertex Llama provider not yet implemented')
    }

    case 'vertex-gemini': {
      // TODO: Implement VertexGeminiProvider as fallback
      // This stays within GCP trust boundary
      throw new Error('Vertex Gemini provider not yet implemented')
    }

    default:
      throw new Error(`Unknown LLM provider: ${provider}`)
  }
}

/**
 * Singleton instance for server-side usage
 * Lazily initialized on first access
 */
let _provider: LLMProvider | null = null

export function getProvider(): LLMProvider {
  if (!_provider) {
    _provider = getLLMProvider()
  }
  return _provider
}
