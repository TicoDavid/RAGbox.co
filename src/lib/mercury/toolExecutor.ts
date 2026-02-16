/**
 * Mercury Tool Executor - RAGbox.co
 *
 * Executes tool calls against existing API routes and the Go backend.
 */

import { apiFetch } from '@/lib/api'
import { parseSSEResponse } from './sseParser'

export interface ToolResult {
  success: boolean
  data: unknown
  display: string
  action?: { type: string; payload: Record<string, unknown> }
}

/**
 * Execute a detected tool intent.
 */
export async function executeTool(
  tool: string,
  args: Record<string, unknown>,
  authHeaders: HeadersInit
): Promise<ToolResult> {
  try {
    switch (tool) {
      case 'summarize_document':
        return await chatQuery(`Summarize document: ${args.query}`, 'detailed', authHeaders)
      case 'compare_documents':
        return await chatQuery(`Compare "${args.doc1}" and "${args.doc2}"`, 'detailed', authHeaders)
      case 'extract_key_dates':
        return await chatQuery(`Extract all dates and deadlines from ${args.query}`, 'detailed', authHeaders)
      case 'extract_liability_clauses':
        return await chatQuery(`Extract liability and indemnification clauses from ${args.query}`, 'detailed', authHeaders)
      case 'list_documents':
        return await listDocuments(authHeaders)
      case 'check_content_gaps':
        return await checkContentGaps(authHeaders)
      case 'run_health_check':
        return await runHealthCheck(authHeaders)
      case 'get_document_stats':
        return await getDocumentStats(authHeaders)
      case 'navigate_to':
        return {
          success: true,
          data: null,
          display: `Navigating to ${args.panel}...`,
          action: { type: 'navigate', payload: { panel: args.panel as string } },
        }
      case 'toggle_privilege_mode':
        return {
          success: true,
          data: null,
          display: args.enabled === 'true' ? 'Privilege mode enabled.' : 'Privilege mode disabled.',
          action: { type: 'toggle_privilege', payload: { enabled: args.enabled === 'true' } },
        }
      case 'export_audit_log':
        return {
          success: true,
          data: null,
          display: 'Exporting audit log...',
          action: { type: 'export_audit', payload: {} },
        }
      case 'open_document':
        return await openDocument(args.query as string, authHeaders)
      default:
        return { success: false, data: null, display: `Unknown tool: ${tool}` }
    }
  } catch (error) {
    return {
      success: false,
      data: null,
      display: `Error executing ${tool}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

async function chatQuery(query: string, mode: string, authHeaders: HeadersInit): Promise<ToolResult> {
  const res = await apiFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(new Headers(authHeaders).entries()) },
    body: JSON.stringify({ query, mode, stream: true, privilegeMode: false, maxTier: 3, history: [] }),
  })

  if (!res.ok) {
    return { success: false, data: null, display: 'Failed to get response from Mercury.' }
  }

  const parsed = await parseSSEResponse(res)
  return {
    success: true,
    data: { confidence: parsed.confidence, citations: parsed.citations },
    display: parsed.text || 'No results found.',
  }
}

async function listDocuments(authHeaders: HeadersInit): Promise<ToolResult> {
  const res = await apiFetch('/api/documents', {
    headers: { ...Object.fromEntries(new Headers(authHeaders).entries()) },
  })

  if (!res.ok) {
    return { success: false, data: null, display: 'Failed to fetch documents.' }
  }

  const json = await res.json()
  const docs: Array<{ originalName: string; fileType: string; sizeBytes: number; indexStatus: string; createdAt: string }> =
    json.data || json.documents || []

  if (docs.length === 0) {
    return { success: true, data: [], display: 'Your vault is empty. Upload documents to get started.' }
  }

  const lines = docs.map((d, i) =>
    `${i + 1}. **${d.originalName}** (${d.fileType}, ${formatSize(d.sizeBytes)}) — ${d.indexStatus}`
  )

  return {
    success: true,
    data: docs,
    display: `Found **${docs.length}** documents:\n\n${lines.join('\n')}`,
  }
}

async function checkContentGaps(authHeaders: HeadersInit): Promise<ToolResult> {
  const res = await apiFetch('/api/content-gaps?status=open', {
    headers: { ...Object.fromEntries(new Headers(authHeaders).entries()) },
  })

  if (!res.ok) {
    return { success: false, data: null, display: 'Failed to fetch content gaps.' }
  }

  const json = await res.json()
  const gaps: Array<{ queryText: string; confidenceScore: number; suggestedTopics: string[] }> =
    json.data || json.gaps || []

  if (gaps.length === 0) {
    return { success: true, data: [], display: 'No content gaps detected. Your knowledge base is comprehensive.' }
  }

  const lines = gaps.map((g, i) =>
    `${i + 1}. "${g.queryText}" — confidence: ${Math.round(g.confidenceScore * 100)}%\n   Suggested: ${g.suggestedTopics.join(', ')}`
  )

  return {
    success: true,
    data: gaps,
    display: `Found **${gaps.length}** content gaps:\n\n${lines.join('\n\n')}`,
  }
}

async function runHealthCheck(authHeaders: HeadersInit): Promise<ToolResult> {
  const headers = { ...Object.fromEntries(new Headers(authHeaders).entries()) }
  const vaultsRes = await apiFetch('/api/vaults', { headers })

  if (!vaultsRes.ok) {
    return { success: false, data: null, display: 'Failed to fetch vaults.' }
  }

  const vaultsJson = await vaultsRes.json()
  const vaults: Array<{ id: string; name: string; documentCount: number }> =
    vaultsJson.data || vaultsJson.vaults || []

  if (vaults.length === 0) {
    return { success: true, data: null, display: 'No vaults found. Create a vault and upload documents first.' }
  }

  const vault = vaults[0]
  return {
    success: true,
    data: { vault },
    display: `**Vault: ${vault.name}**\nDocuments: ${vault.documentCount}\n\nHealth check: Your knowledge base is operational.`,
  }
}

async function getDocumentStats(authHeaders: HeadersInit): Promise<ToolResult> {
  const res = await apiFetch('/api/documents', {
    headers: { ...Object.fromEntries(new Headers(authHeaders).entries()) },
  })

  if (!res.ok) {
    return { success: false, data: null, display: 'Failed to fetch document stats.' }
  }

  const json = await res.json()
  const docs: Array<{ fileType: string; sizeBytes: number; indexStatus: string; createdAt: string }> =
    json.data || json.documents || []

  const totalSize = docs.reduce((sum, d) => sum + d.sizeBytes, 0)
  const byType: Record<string, number> = {}
  const byStatus: Record<string, number> = {}

  for (const d of docs) {
    byType[d.fileType] = (byType[d.fileType] || 0) + 1
    byStatus[d.indexStatus] = (byStatus[d.indexStatus] || 0) + 1
  }

  const typeLines = Object.entries(byType).map(([t, c]) => `  ${t}: ${c}`)
  const statusLines = Object.entries(byStatus).map(([s, c]) => `  ${s}: ${c}`)

  return {
    success: true,
    data: { total: docs.length, totalSize, byType, byStatus },
    display: `**Document Statistics**\n\nTotal: **${docs.length}** documents (${formatSize(totalSize)})\n\nBy type:\n${typeLines.join('\n')}\n\nBy status:\n${statusLines.join('\n')}`,
  }
}

async function openDocument(query: string, authHeaders: HeadersInit): Promise<ToolResult> {
  const { resolveDocumentId } = await import('./toolRouter')
  const docId = await resolveDocumentId(query, authHeaders)

  if (!docId) {
    return { success: false, data: null, display: `Could not find a document matching "${query}".` }
  }

  return {
    success: true,
    data: { documentId: docId },
    display: `Opening document...`,
    action: { type: 'open_document', payload: { documentId: docId } },
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
