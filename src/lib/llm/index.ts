import type { LLMProvider } from './provider'
import { OpenRouterProvider } from './openrouter'
import { VertexGeminiProvider } from './vertex-gemini'
import { VertexLlamaProvider } from './vertex-llama'

export type { LLMProvider } from './provider'
export { RAGBOX_SYSTEM_PROMPT, buildRAGPrompt } from './provider'
export { OpenRouterProvider } from './openrouter'
export { VertexGeminiProvider } from './vertex-gemini'
export { VertexLlamaProvider } from './vertex-llama'

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
      const projectId = process.env.GOOGLE_CLOUD_PROJECT
      if (!projectId) {
        throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required for Vertex Llama provider')
      }
      const location = process.env.VERTEX_AI_LOCATION || 'us-central1'
      const endpointId = process.env.VERTEX_LLAMA_ENDPOINT_ID
      const llamaModel = process.env.VERTEX_LLAMA_MODEL || 'llama-3.3-70b-instruct'
      return new VertexLlamaProvider(projectId, location, endpointId, llamaModel)
    }

    case 'vertex-gemini': {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT
      if (!projectId) {
        throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required for Vertex Gemini provider')
      }
      const location = process.env.VERTEX_AI_LOCATION || 'us-central1'
      const geminiModel = process.env.VERTEX_AI_MODEL || 'gemini-1.5-pro'
      return new VertexGeminiProvider(projectId, location, geminiModel)
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
