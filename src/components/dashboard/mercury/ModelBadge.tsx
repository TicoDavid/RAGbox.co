/**
 * ModelBadge — Shows which LLM generated the response.
 *
 * STORY-026: Reads model_used from SSE metadata event.
 * AEGIS → branded blue badge. BYOLLM → neutral badge with clean model name.
 */

interface ModelBadgeProps {
  modelUsed?: string
  provider?: string
  latencyMs?: number
}

/** Strip provider prefix and format model name for display. */
function formatModelLabel(raw: string): string {
  // Strip provider prefix: "deepseek/deepseek-chat-v3.1" → "deepseek-chat-v3.1"
  const modelName = raw.includes('/') ? raw.split('/').pop()! : raw

  // Known model → human-friendly name
  const known: Record<string, string> = {
    'deepseek-chat-v3.1': 'DeepSeek V3.1',
    'deepseek-chat': 'DeepSeek Chat',
    'deepseek-reasoner': 'DeepSeek R1',
    'claude-3.5-sonnet': 'Claude 3.5 Sonnet',
    'claude-3-opus': 'Claude 3 Opus',
    'claude-3-haiku': 'Claude 3 Haiku',
    'claude-sonnet-4': 'Claude Sonnet 4',
    'claude-opus-4': 'Claude Opus 4',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4.1': 'GPT-4.1',
    'o3': 'o3',
    'o3-mini': 'o3-mini',
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-1.5-pro': 'Gemini 1.5 Pro',
    'llama-3.1-70b': 'Llama 3.1 70B',
    'llama-3.1-8b': 'Llama 3.1 8B',
    'mistral-large': 'Mistral Large',
    'mixtral-8x7b': 'Mixtral 8x7B',
    'qwen-2.5-72b': 'Qwen 2.5 72B',
  }

  if (known[modelName]) return known[modelName]

  // Fallback: title-case with dash → space
  return modelName
    .replace(/-/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

export function ModelBadge({ modelUsed, provider, latencyMs }: ModelBadgeProps) {
  if (!modelUsed) return null

  const isAegis = modelUsed === 'aegis' || provider === 'aegis' || (!provider && modelUsed.startsWith('aegis'))

  const label = isAegis ? 'AEGIS' : formatModelLabel(modelUsed)
  const emoji = isAegis ? '\u26A1' : '\uD83E\uDD16'

  // AEGIS → brand blue. BYOLLM → neutral (text-secondary with subtle bg)
  const colorClass = isAegis
    ? 'bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]'
    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'

  const latencySuffix = latencyMs != null
    ? ` \u00B7 ${(latencyMs / 1000).toFixed(1)}s`
    : ''

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {emoji} {label}{latencySuffix}
    </span>
  )
}
