/**
 * OpenRouter Service - The Universal Gateway
 *
 * Provides authenticated access to 100+ AI models through a single API key.
 * Acts as a "skeleton key" to OpenAI, Anthropic, Google, Meta, and more.
 */

export interface OpenRouterModel {
  id: string
  name: string
  description?: string
  context_length: number
  pricing: {
    prompt: string
    completion: string
  }
  top_provider?: {
    is_moderated: boolean
  }
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[]
}

export interface OpenRouterVerifyResult {
  success: boolean
  error?: string
  models?: OpenRouterModel[]
  credits?: number
}

// Popular models to surface at the top
const FEATURED_MODEL_IDS = [
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-opus',
  'openai/gpt-4-turbo',
  'openai/gpt-4o',
  'google/gemini-pro-1.5',
  'meta-llama/llama-3.1-405b-instruct',
  'mistralai/mistral-large',
]

/**
 * Verify an OpenRouter API key and fetch available models
 */
export async function verifyAndFetchModels(apiKey: string): Promise<OpenRouterVerifyResult> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://ragbox.co',
        'X-Title': 'RAGbox',
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Invalid API key' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Access forbidden - check API key permissions' }
      }
      return { success: false, error: `API error: ${response.status}` }
    }

    const data: OpenRouterModelsResponse = await response.json()

    // Sort models: featured first, then by name
    const sortedModels = data.data.sort((a, b) => {
      const aFeatured = FEATURED_MODEL_IDS.includes(a.id)
      const bFeatured = FEATURED_MODEL_IDS.includes(b.id)

      if (aFeatured && !bFeatured) return -1
      if (!aFeatured && bFeatured) return 1

      // Within same category, sort by name
      return a.name.localeCompare(b.name)
    })

    return {
      success: true,
      models: sortedModels,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Get a human-readable display name for a model ID
 */
export function getModelDisplayName(modelId: string): string {
  // Extract the model name from the full ID (e.g., "anthropic/claude-3.5-sonnet" -> "Claude 3.5 Sonnet")
  const parts = modelId.split('/')
  if (parts.length < 2) return modelId

  const modelName = parts[1]
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/(\d+)\.(\d+)/g, '$1.$2') // Keep version numbers formatted

  return modelName
}

/**
 * Get provider name from model ID
 */
export function getProviderFromModelId(modelId: string): string {
  const parts = modelId.split('/')
  if (parts.length < 2) return 'Unknown'

  const providerMap: Record<string, string> = {
    'anthropic': 'Anthropic',
    'openai': 'OpenAI',
    'google': 'Google',
    'meta-llama': 'Meta',
    'mistralai': 'Mistral AI',
    'cohere': 'Cohere',
    'perplexity': 'Perplexity',
  }

  return providerMap[parts[0]] || parts[0]
}

/**
 * Format pricing for display
 */
export function formatPricing(prompt: string, completion: string): string {
  const promptNum = parseFloat(prompt)
  const completionNum = parseFloat(completion)

  if (promptNum === 0 && completionNum === 0) return 'Free'

  // Convert from per-token to per-1M tokens
  const promptPer1M = (promptNum * 1_000_000).toFixed(2)
  const completionPer1M = (completionNum * 1_000_000).toFixed(2)

  return `$${promptPer1M} / $${completionPer1M} per 1M tokens`
}

/**
 * OpenRouter endpoint constant
 */
export const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1'
