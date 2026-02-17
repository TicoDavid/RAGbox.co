/**
 * Mercury Tool Router - RAGbox.co
 *
 * Detects tool intents from user messages using pattern matching.
 * Returns null for RAG queries (default path).
 */

export interface ToolIntent {
  tool: string
  args: Record<string, string>
  confidence: number
}

interface PatternDef {
  pattern: RegExp
  tool: string
  argMap: (m: RegExpMatchArray) => Record<string, string>
}

const TOOL_PATTERNS: PatternDef[] = [
  // Email patterns (must come before summarize to catch "email the summary of X to Y")
  { pattern: /^(?:email|send\s+(?:an?\s+)?email|mail)\s+(.+?)\s+to\s+([^\s]+@[^\s]+)/i,
    tool: 'send_email', argMap: (m) => ({ content: m[1], to: m[2] }) },
  { pattern: /^(?:email|send\s+(?:an?\s+)?email|mail)\s+(.+)/i,
    tool: 'send_email', argMap: (m) => ({ content: m[1] }) },

  // SMS patterns
  { pattern: /^(?:text|sms|send\s+(?:a\s+)?(?:text|sms))\s+(.+?)\s+to\s+(\+?[\d\-().\s]{7,})/i,
    tool: 'send_sms', argMap: (m) => ({ content: m[1], to: m[2].replace(/[\s\-().]/g, '') }) },
  { pattern: /^(?:text|sms|send\s+(?:a\s+)?(?:text|sms))\s+(.+)/i,
    tool: 'send_sms', argMap: (m) => ({ content: m[1] }) },

  // Document tools
  { pattern: /^(summarize|summarise|summary of)\s+(.+)/i, tool: 'summarize_document', argMap: (m) => ({ query: m[2] }) },
  { pattern: /^(compare|diff)\s+(.+?)\s+(?:with|to|and|vs)\s+(.+)/i, tool: 'compare_documents', argMap: (m) => ({ doc1: m[2], doc2: m[3] }) },
  { pattern: /^(?:find|extract|show|get)\s+(?:dates?|deadlines?|key dates?)\s+(?:in|from|of)\s+(.+)/i, tool: 'extract_key_dates', argMap: (m) => ({ query: m[1] }) },
  { pattern: /^(?:find|extract|show|get)\s+(?:liability|indemnif)/i, tool: 'extract_liability_clauses', argMap: (m) => ({ query: m[0] }) },
  { pattern: /^(?:list|show)\s+(?:all\s+)?(?:documents?|files?|docs?)/i, tool: 'list_documents', argMap: () => ({}) },
  { pattern: /^(?:search|find)\s+(?:for\s+)?(.+?)\s+(?:in\s+)?(?:documents?|vault|files?)/i, tool: 'search_documents', argMap: (m) => ({ query: m[1] }) },
  { pattern: /^(?:search|find)\s+(?:documents?|files?)\s+(?:for|about|matching)\s+(.+)/i, tool: 'search_documents', argMap: (m) => ({ query: m[1] }) },
  { pattern: /^(?:open|view|show)\s+(.+\.(?:pdf|docx|txt|doc))/i, tool: 'open_document', argMap: (m) => ({ query: m[1] }) },
  { pattern: /^(?:get|show|check)\s+(?:document|file)\s+status(?:\s+(?:of|for)\s+(.+))?/i, tool: 'get_document_status', argMap: (m) => ({ query: m[1] || '' }) },
  { pattern: /^(?:check\s+)?upload\s+status/i, tool: 'upload_status', argMap: () => ({}) },
  { pattern: /^(?:check|show|what are)\s+(?:the\s+)?(?:content\s+)?gaps?/i, tool: 'check_content_gaps', argMap: () => ({}) },
  { pattern: /^(?:run|check|show)\s+(?:the\s+)?(?:kb\s+|knowledge\s+)?health/i, tool: 'run_health_check', argMap: () => ({}) },
  { pattern: /^(?:show|check)\s+(?:system\s+)?status/i, tool: 'run_health_check', argMap: () => ({}) },
  { pattern: /^(?:export|download)\s+(?:the\s+)?audit\s*(?:log|trail)?/i, tool: 'export_audit_log', argMap: () => ({}) },
  { pattern: /^(?:show|get|what are)\s+(?:the\s+)?(?:document\s+)?stats/i, tool: 'get_document_stats', argMap: () => ({}) },
  { pattern: /^(?:navigate|go|switch)\s+to\s+(.+)/i, tool: 'navigate_to', argMap: (m) => ({ panel: m[1].trim() }) },
  { pattern: /^(enable|disable|toggle)\s+privilege/i, tool: 'toggle_privilege_mode', argMap: (m) => ({ enabled: String(/enable/i.test(m[0])) }) },
  { pattern: /^(?:check|show|what(?:'s| is))\s+(?:the\s+)?(?:response\s+)?confidence(?:\s+score)?/i, tool: 'check_confidence', argMap: () => ({}) },
  { pattern: /^(?:find|extract|show|identify|list)\s+(?:the\s+)?(?:legal\s+)?risks?(?:\s+in\s+(.+))?/i, tool: 'find_risks', argMap: (m) => ({ query: m[1] || 'all documents' }) },
  { pattern: /^(?:show|list)\s+(?:recent\s+)?(?:my\s+)?activity/i, tool: 'recent_activity', argMap: () => ({}) },
  { pattern: /^(?:list|show)\s+(?:my\s+)?documents?/i, tool: 'list_documents', argMap: () => ({}) },
  { pattern: /^(?:check|show)\s+(?:my\s+)?(?:content\s+)?gaps?/i, tool: 'check_content_gaps', argMap: () => ({}) },

  // Help command
  { pattern: /^\/help\s*$/i, tool: 'show_help', argMap: () => ({}) },
  { pattern: /^(?:help|what can you do|how do I|commands?)/i, tool: 'show_help', argMap: () => ({}) },
]

export function detectToolIntent(message: string): ToolIntent | null {
  const trimmed = message.trim()
  for (const { pattern, tool, argMap } of TOOL_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      return { tool, args: argMap(match), confidence: 0.9 }
    }
  }
  return null
}

export async function resolveDocumentId(
  query: string,
  authHeaders: HeadersInit
): Promise<string | null> {
  try {
    const { apiFetch } = await import('@/lib/api')
    const res = await apiFetch('/api/documents', { headers: authHeaders })
    if (!res.ok) return null

    const json = await res.json()
    const docs: Array<{ id: string; originalName: string; filename: string }> =
      json.data || json.documents || []

    const q = query.toLowerCase()
    const match = docs.find(
      (d) =>
        d.originalName.toLowerCase().includes(q) ||
        d.filename.toLowerCase().includes(q)
    )
    return match?.id || null
  } catch {
    return null
  }
}
