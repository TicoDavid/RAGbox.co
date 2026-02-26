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
  requiresConfirmation?: boolean
  confirmationPayload?: Record<string, unknown>
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
      case 'search_documents':
        return await chatQuery(`Search my documents for: ${args.query}`, 'search', authHeaders)
      case 'get_document_status':
        return await getDocumentStatus(args.query as string || '', authHeaders)
      case 'upload_status':
        return await getUploadStatus(authHeaders)
      case 'check_content_gaps':
        return await checkContentGaps(authHeaders)
      case 'run_health_check':
        return await runHealthCheck(authHeaders)
      case 'get_document_stats':
        return await getDocumentStats(authHeaders)
      case 'check_confidence':
        return checkConfidence()
      case 'find_risks':
        return await chatQuery(
          `Analyze and identify all legal, financial, and compliance risks in ${args.query}. List each risk with severity (High/Medium/Low).`,
          'detailed',
          authHeaders
        )
      case 'recent_activity':
        return await getRecentActivity(authHeaders)
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
      case 'delete_document':
        return await prepareDeleteDocument(args.query as string, authHeaders)
      case 'send_email':
        return await prepareSendEmail(args, authHeaders)
      case 'send_sms':
        return await prepareSendSms(args)
      case 'show_help':
        return showHelp()
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
  const docs = extractArray(json) as Array<{ originalName: string; fileType: string; sizeBytes: number; indexStatus: string; createdAt: string }>

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
  const docs = extractArray(json) as Array<{ fileType: string; sizeBytes: number; indexStatus: string; createdAt: string }>

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

async function prepareDeleteDocument(query: string, authHeaders: HeadersInit): Promise<ToolResult> {
  const { resolveDocumentId } = await import('./toolRouter')
  const docId = await resolveDocumentId(query, authHeaders)

  if (!docId) {
    return { success: false, data: null, display: `Could not find a document matching "${query}".` }
  }

  return {
    success: true,
    data: { documentId: docId },
    display: `Are you sure you want to delete the document matching "${query}"? This action cannot be undone.`,
    requiresConfirmation: true,
    confirmationPayload: { type: 'delete_document', documentId: docId },
  }
}

async function prepareSendEmail(
  args: Record<string, unknown>,
  authHeaders: HeadersInit,
): Promise<ToolResult> {
  if (!args.to) {
    return {
      success: true,
      data: null,
      display: "I can send that email. Who should I send it to? (Provide an email address)",
    }
  }

  const to = args.to as string
  const contentHint = (args.content as string) || ''

  // Generate subject from content
  const subject = `Mercury: ${contentHint.slice(0, 60)}${contentHint.length > 60 ? '...' : ''}`

  // If content references a document summary/extract, resolve via RAG
  let emailBody = contentHint
  if (/summary|summarize|extract|compare|report/i.test(contentHint)) {
    const ragResult = await chatQuery(contentHint, 'detailed', authHeaders)
    if (ragResult.success && ragResult.display) {
      emailBody = ragResult.display
    }
  }

  return {
    success: true,
    data: { to, subject, body: emailBody },
    display: `Ready to send email to **${to}**\n\n**Subject:** ${subject}\n\n${emailBody.slice(0, 200)}${emailBody.length > 200 ? '...' : ''}`,
    requiresConfirmation: true,
    confirmationPayload: {
      type: 'send_email',
      to,
      subject,
      body: emailBody,
    },
  }
}

async function prepareSendSms(args: Record<string, unknown>): Promise<ToolResult> {
  if (!args.to) {
    return {
      success: true,
      data: null,
      display: "I can send that text. What phone number should I send it to?",
    }
  }

  const to = args.to as string
  const smsBody = (args.content as string) || ''

  return {
    success: true,
    data: { to, body: smsBody },
    display: `Ready to send SMS to **${to}**\n\n"${smsBody}"`,
    requiresConfirmation: true,
    confirmationPayload: {
      type: 'send_sms',
      to,
      body: smsBody,
    },
  }
}

async function getDocumentStatus(query: string, authHeaders: HeadersInit): Promise<ToolResult> {
  const headers = { ...Object.fromEntries(new Headers(authHeaders).entries()) }
  const res = await apiFetch('/api/documents', { headers })

  if (!res.ok) {
    return { success: false, data: null, display: 'Failed to fetch document status.' }
  }

  const json = await res.json()
  const docs = extractArray(json) as Array<{ id: string; originalName: string; indexStatus: string; sizeBytes: number; createdAt: string }>

  if (query) {
    const q = query.toLowerCase()
    const match = docs.find((d) => d.originalName.toLowerCase().includes(q))
    if (match) {
      return {
        success: true,
        data: match,
        display: `**${match.originalName}**\nStatus: ${match.indexStatus}\nSize: ${formatSize(match.sizeBytes)}\nUploaded: ${new Date(match.createdAt).toLocaleDateString()}`,
      }
    }
    return { success: true, data: null, display: `No document found matching "${query}".` }
  }

  const lines = docs.map((d, i) => `${i + 1}. **${d.originalName}** — ${d.indexStatus}`)
  return {
    success: true,
    data: docs,
    display: `**Document Status**\n\n${lines.join('\n')}`,
  }
}

async function getUploadStatus(authHeaders: HeadersInit): Promise<ToolResult> {
  const headers = { ...Object.fromEntries(new Headers(authHeaders).entries()) }
  const res = await apiFetch('/api/documents', { headers })

  if (!res.ok) {
    return { success: false, data: null, display: 'Failed to fetch upload status.' }
  }

  const json = await res.json()
  const docs = extractArray(json) as Array<{ originalName: string; indexStatus: string; createdAt: string }>

  const pending = docs.filter((d) => ['Uploading', 'Pending', 'Processing', 'Parsing', 'Embedding'].includes(d.indexStatus))

  if (pending.length === 0) {
    return { success: true, data: [], display: 'No uploads in progress. All documents are indexed.' }
  }

  const lines = pending.map((d, i) => `${i + 1}. **${d.originalName}** — ${d.indexStatus}`)
  return {
    success: true,
    data: pending,
    display: `**${pending.length}** upload(s) in progress:\n\n${lines.join('\n')}`,
  }
}

function checkConfidence(): ToolResult {
  // Read last assistant message confidence from the store (client-side only)
  // Since toolExecutor runs server-side in the chat flow, we return instructions
  // for the client to check its own store
  return {
    success: true,
    data: null,
    display: 'The confidence score is shown on each Mercury response as a badge. Look for the percentage indicator on the latest response. Scores above 85% indicate high confidence; below 85% triggers the Silence Protocol.',
  }
}

async function getRecentActivity(authHeaders: HeadersInit): Promise<ToolResult> {
  const headers = { ...Object.fromEntries(new Headers(authHeaders).entries()) }
  const res = await apiFetch('/api/audit?limit=10', { headers })

  if (!res.ok) {
    return { success: false, data: null, display: 'Failed to fetch recent activity.' }
  }

  const json = await res.json()
  const entries: Array<{ action: string; description: string; createdAt: string; severity: string }> =
    json.data || json.auditLog || json.entries || []

  if (entries.length === 0) {
    return { success: true, data: [], display: 'No recent activity found.' }
  }

  const lines = entries.map((e, i) =>
    `${i + 1}. [${new Date(e.createdAt).toLocaleString()}] **${e.action}** — ${e.description || 'No description'}`
  )

  return {
    success: true,
    data: entries,
    display: `**Recent Activity (last ${entries.length})**\n\n${lines.join('\n')}`,
  }
}

function showHelp(): ToolResult {
  const helpText = [
    '**Here\'s what I can do for you:**',
    '',
    '**Ask me about your documents**',
    'Just ask in plain language — I\'ll pull the answer from your vault with citations.',
    '- "What are the key risks in this contract?"',
    '- "Summarize the Q3 report"',
    '- "Compare these two agreements"',
    '- "Find all the deadlines"',
    '',
    '**Manage your vault**',
    '- "List my documents" — see everything in your vault',
    '- "Search for liability clauses" — find specific content',
    '- "Show document status" — check what\'s been indexed',
    '- "Show stats" — document count, size, and health',
    '',
    '**Take action**',
    '- "Email the summary to jane@company.com" — send findings directly',
    '- "Text the key dates to +1234567890" — SMS a quick briefing',
    '- "Export the audit log" — download your full audit trail',
    '',
    '**Go deeper**',
    '- "Find risks" — surface legal, financial, and compliance risks',
    '- "Check content gaps" — identify what\'s missing from your vault',
    '- "Enable privilege mode" — access restricted documents',
    '',
    'Or just type your question — that\'s what I\'m here for.',
  ].join('\n')

  return {
    success: true,
    data: null,
    display: helpText,
  }
}

/** Safely extract an array from API responses like { data: { documents: [...] } } */
function extractArray(json: Record<string, unknown>): unknown[] {
  const r = json.data ?? json
  if (Array.isArray(r)) return r
  if (r && typeof r === 'object') {
    const obj = r as Record<string, unknown>
    if (Array.isArray(obj.documents)) return obj.documents
    if (Array.isArray(obj.data)) return obj.data
  }
  return []
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
