/**
 * Shared AI model catalog — single source of truth for per-provider model lists.
 * Used by AIModelSettings, ChatModelPicker, and /api/models/list.
 */

export interface ModelEntry {
  id: string
  name: string
  description?: string
}

export interface ProviderCatalog {
  label: string
  models: ModelEntry[]
}

export const MODEL_CATALOG: Record<string, ProviderCatalog> = {
  openrouter: {
    label: 'OpenRouter',
    models: [
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Fast, capable reasoning' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Previous generation' },
      { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'OpenAI flagship' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', description: 'Google production model' },
      { id: 'google/gemini-2.0-pro', name: 'Gemini 2.0 Pro', description: 'Google advanced reasoning' },
      { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', description: 'Open-source flagship' },
      { id: 'mistralai/mistral-large', name: 'Mistral Large', description: 'European frontier model' },
    ],
  },
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Flagship multimodal' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High capability' },
      { id: 'o1', name: 'o1', description: 'Reasoning model' },
      { id: 'o1-mini', name: 'o1-mini', description: 'Fast reasoning' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Balanced performance' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: 'Most capable' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', description: 'Fastest responses' },
    ],
  },
  google: {
    label: 'Google AI',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Production model — current default' },
      { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', description: 'Advanced reasoning' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Long context window' },
    ],
  },
}

/**
 * Flat list of { id, name } for a given provider.
 * Used as fallback when API is unavailable.
 */
export function getModelsForProvider(provider: string): ModelEntry[] {
  return MODEL_CATALOG[provider]?.models ?? []
}

/**
 * Get the display label for a provider key.
 */
export function getProviderLabel(provider: string): string {
  return MODEL_CATALOG[provider]?.label ?? provider
}
