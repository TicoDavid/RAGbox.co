/**
 * OpenRouter Intelligence Matrix
 *
 * Fetches and caches all available models from OpenRouter's universe.
 * Supports the Three-Tiered Intelligence architecture:
 * - Tier 0: Aegis (Native GCP/Vertex)
 * - Tier 1: Managed Fleet (OpenRouter via RAGbox key)
 * - Tier 2: Private Uplinks (User BYO keys)
 */

export interface OpenRouterModel {
  id: string
  name: string
  description?: string
  contextLength: number
  pricing: {
    prompt: number   // per million tokens
    completion: number
  }
  topProvider?: {
    isModerated?: boolean
  }
  architecture?: {
    modality?: string
    tokenizer?: string
    instruct_type?: string
  }
}

export interface IntelligenceOption {
  id: string
  name: string
  displayName: string
  provider: string
  tier: 'native' | 'managed' | 'universe' | 'private'
  contextLength?: number
  description?: string
  icon?: 'shield' | 'brain' | 'zap' | 'key' | 'globe'
}

// Cache for OpenRouter models
let cachedModels: OpenRouterModel[] | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// The RAGbox "Managed Fleet" - curated models we manage via our OpenRouter key
export const MANAGED_FLEET: IntelligenceOption[] = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'claude-3.5-sonnet',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    tier: 'managed',
    contextLength: 200000,
    description: 'Best for complex reasoning and analysis',
    icon: 'brain',
  },
  {
    id: 'openai/gpt-4o',
    name: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'OpenAI',
    tier: 'managed',
    contextLength: 128000,
    description: 'Fastest multimodal intelligence',
    icon: 'zap',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'OpenAI',
    tier: 'managed',
    contextLength: 128000,
    description: 'Cost-effective for routine tasks',
    icon: 'zap',
  },
  {
    id: 'meta-llama/llama-3.1-405b-instruct',
    name: 'llama-3.1-405b',
    displayName: 'Llama 3.1 405B',
    provider: 'Meta',
    tier: 'managed',
    contextLength: 131072,
    description: 'Open-source powerhouse',
    icon: 'globe',
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'gemini-pro-1.5',
    displayName: 'Gemini Pro 1.5',
    provider: 'Google',
    tier: 'managed',
    contextLength: 2000000,
    description: 'Massive context window',
    icon: 'globe',
  },
  {
    id: 'mistralai/mistral-large',
    name: 'mistral-large',
    displayName: 'Mistral Large',
    provider: 'Mistral',
    tier: 'managed',
    contextLength: 128000,
    description: 'European sovereign AI',
    icon: 'globe',
  },
]

// Aegis - The sovereign default
export const AEGIS_INTELLIGENCE: IntelligenceOption = {
  id: 'aegis-core',
  name: 'aegis',
  displayName: 'Aegis',
  provider: 'RAGbox',
  tier: 'native',
  contextLength: 1000000,
  description: 'Sovereign AI running on RAGbox infrastructure',
  icon: 'shield',
}

/**
 * Fetch all available models from OpenRouter
 */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  // Return cached if valid
  const now = Date.now()
  if (cachedModels && now - cacheTimestamp < CACHE_TTL) {
    return cachedModels
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    cachedModels = data.data || []
    cacheTimestamp = now

    return cachedModels || []
  } catch (error) {
    // Return empty array on error, don't break the UI
    return []
  }
}

/**
 * Convert OpenRouter models to IntelligenceOptions
 */
export function convertToIntelligenceOptions(models: OpenRouterModel[]): IntelligenceOption[] {
  return models.map(model => {
    const parts = model.id.split('/')
    const provider = parts[0] || 'Unknown'

    return {
      id: model.id,
      name: parts[1] || model.id,
      displayName: model.name,
      provider: formatProviderName(provider),
      tier: 'universe' as const,
      contextLength: model.contextLength,
      description: model.description,
      icon: 'globe' as const,
    }
  })
}

/**
 * Format provider name for display
 */
function formatProviderName(provider: string): string {
  const providerMap: Record<string, string> = {
    'anthropic': 'Anthropic',
    'openai': 'OpenAI',
    'google': 'Google',
    'meta-llama': 'Meta',
    'mistralai': 'Mistral',
    'cohere': 'Cohere',
    'perplexity': 'Perplexity',
    'deepseek': 'DeepSeek',
    'qwen': 'Qwen',
    '01-ai': '01.AI',
    'nvidia': 'NVIDIA',
    'x-ai': 'xAI',
  }
  return providerMap[provider] || provider.charAt(0).toUpperCase() + provider.slice(1)
}

/**
 * Search models by query
 */
export function searchModels(
  models: IntelligenceOption[],
  query: string
): IntelligenceOption[] {
  if (!query.trim()) return models

  const lowerQuery = query.toLowerCase()
  return models.filter(model =>
    model.displayName.toLowerCase().includes(lowerQuery) ||
    model.provider.toLowerCase().includes(lowerQuery) ||
    model.id.toLowerCase().includes(lowerQuery) ||
    model.description?.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Get all intelligence options for the Matrix
 */
export async function getIntelligenceMatrix(
  privateConnections?: Array<{ id: string; name: string; type: string; selectedModel?: string }>
): Promise<{
  native: IntelligenceOption[]
  managed: IntelligenceOption[]
  universe: IntelligenceOption[]
  private: IntelligenceOption[]
}> {
  // Fetch OpenRouter models
  const openRouterModels = await fetchOpenRouterModels()
  const universeOptions = convertToIntelligenceOptions(openRouterModels)

  // Filter out managed fleet from universe to avoid duplicates
  const managedIds = new Set(MANAGED_FLEET.map(m => m.id))
  const filteredUniverse = universeOptions.filter(m => !managedIds.has(m.id))

  // Build private uplinks from user connections
  const privateUplinks: IntelligenceOption[] = (privateConnections || [])
    .filter(conn => conn.selectedModel)
    .map(conn => ({
      id: conn.selectedModel!,
      name: conn.selectedModel!.split('/')[1] || conn.selectedModel!,
      displayName: conn.name,
      provider: conn.type === 'openai' ? 'OpenAI' : conn.type === 'anthropic' ? 'Anthropic' : conn.type,
      tier: 'private' as const,
      icon: 'key' as const,
    }))

  return {
    native: [AEGIS_INTELLIGENCE],
    managed: MANAGED_FLEET,
    universe: filteredUniverse,
    private: privateUplinks,
  }
}

/**
 * Format context length for display
 */
export function formatContextLength(length?: number): string {
  if (!length) return ''
  if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M`
  if (length >= 1000) return `${Math.round(length / 1000)}K`
  return String(length)
}
