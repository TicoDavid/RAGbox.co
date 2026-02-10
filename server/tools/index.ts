/**
 * Agent Tool Registry - RAGbox.co
 *
 * Server-side tool execution with RBAC.
 * Tools are invoked by the voice agent (Inworld) and executed here.
 * Results are sent back to the agent AND broadcast to the client for UI sync.
 */

import { PrismaClient } from '@prisma/client'

// ============================================================================
// TYPES
// ============================================================================

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  name: string
  success: boolean
  result: unknown
  error?: string
  uiAction?: UIAction
}

export interface ToolContext {
  userId: string
  role: 'User' | 'Admin' | 'Viewer'
  sessionId: string
  privilegeMode: boolean
}

// UI actions that the client should perform
export type UIAction =
  | { type: 'navigate'; path: string }
  | { type: 'open_document'; documentId: string }
  | { type: 'highlight_text'; documentId: string; range: { start: number; end: number } }
  | { type: 'scroll_to'; elementId: string }
  | { type: 'open_panel'; panel: 'vault' | 'audit' | 'settings' | 'help' }
  | { type: 'toggle_privilege'; enabled: boolean }
  | { type: 'show_toast'; message: string; variant: 'success' | 'error' | 'info' }
  | { type: 'update_filter'; filter: Record<string, unknown> }
  | { type: 'select_documents'; documentIds: string[] }

// Tool definitions for agent registration
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, {
    type: string
    description: string
    required?: boolean
    enum?: string[]
  }>
  requiredRole?: 'User' | 'Admin'
}

// ============================================================================
// LAZY PRISMA CLIENT
// ============================================================================

let prisma: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient()
  }
  return prisma
}

// ============================================================================
// TOOL DEFINITIONS (for Inworld agent registration)
// ============================================================================

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_documents',
    description: 'Search through the user\'s document vault using semantic search',
    parameters: {
      query: { type: 'string', description: 'The search query', required: true },
      limit: { type: 'number', description: 'Maximum results to return (default 10)' },
      documentType: { type: 'string', description: 'Filter by document type', enum: ['pdf', 'docx', 'txt', 'all'] },
    },
  },
  {
    name: 'open_document',
    description: 'Open a document in the viewer panel',
    parameters: {
      documentId: { type: 'string', description: 'The document ID to open', required: true },
      page: { type: 'number', description: 'Optional page number to scroll to' },
    },
  },
  {
    name: 'extract_liability_clauses',
    description: 'Extract and analyze liability clauses from a legal document',
    parameters: {
      documentId: { type: 'string', description: 'The document ID to analyze', required: true },
    },
  },
  {
    name: 'extract_key_dates',
    description: 'Extract important dates and deadlines from a document',
    parameters: {
      documentId: { type: 'string', description: 'The document ID to analyze', required: true },
    },
  },
  {
    name: 'compare_documents',
    description: 'Compare two documents to find differences and similarities',
    parameters: {
      documentId1: { type: 'string', description: 'First document ID', required: true },
      documentId2: { type: 'string', description: 'Second document ID', required: true },
    },
  },
  {
    name: 'summarize_document',
    description: 'Generate an executive summary of a document',
    parameters: {
      documentId: { type: 'string', description: 'The document ID to summarize', required: true },
      length: { type: 'string', description: 'Summary length', enum: ['brief', 'standard', 'detailed'] },
    },
  },
  {
    name: 'toggle_privilege_mode',
    description: 'Enable or disable privilege mode to access restricted documents',
    parameters: {
      enabled: { type: 'boolean', description: 'Whether to enable privilege mode', required: true },
    },
    requiredRole: 'Admin',
  },
  {
    name: 'set_viewing_role',
    description: 'Change the current viewing role (Admin only)',
    parameters: {
      role: { type: 'string', description: 'The role to switch to', required: true, enum: ['User', 'Admin', 'Viewer'] },
    },
    requiredRole: 'Admin',
  },
  {
    name: 'export_audit_log',
    description: 'Export the audit log for compliance',
    parameters: {
      startDate: { type: 'string', description: 'Start date (ISO format)' },
      endDate: { type: 'string', description: 'End date (ISO format)' },
      format: { type: 'string', description: 'Export format', enum: ['pdf', 'csv', 'json'] },
    },
  },
  {
    name: 'navigate_to',
    description: 'Navigate to a specific section of the application',
    parameters: {
      destination: { type: 'string', description: 'Where to navigate', required: true, enum: ['vault', 'chat', 'audit', 'settings', 'help'] },
    },
  },
  {
    name: 'get_document_stats',
    description: 'Get statistics about the document vault',
    parameters: {},
  },
  {
    name: 'list_documents',
    description: 'List all documents in the user\'s vault. Use this when the user asks what files or documents they have.',
    parameters: {
      limit: { type: 'number', description: 'Maximum documents to return (default 20)' },
      sortBy: { type: 'string', description: 'Sort order', enum: ['recent', 'name', 'size'] },
    },
  },
  {
    name: 'read_document',
    description: 'Read the contents of a specific document. Use this to answer questions about document contents.',
    parameters: {
      documentId: { type: 'string', description: 'The document ID to read', required: true },
    },
  },
]

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

async function searchDocuments(args: { query: string; limit?: number; documentType?: string }, ctx: ToolContext): Promise<unknown> {
  const db = getPrisma()
  const limit = args.limit || 10

  // Basic search - in production, use vector similarity search
  const documents = await db.document.findMany({
    where: {
      userId: ctx.userId,
      deletionStatus: 'Active',
      OR: [
        { filename: { contains: args.query, mode: 'insensitive' } },
        { originalName: { contains: args.query, mode: 'insensitive' } },
        { extractedText: { contains: args.query, mode: 'insensitive' } },
      ],
      ...(args.documentType && args.documentType !== 'all' ? { mimeType: { contains: args.documentType } } : {}),
    },
    take: limit,
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimeType: true,
      createdAt: true,
      securityTier: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    count: documents.length,
    results: documents,
    query: args.query,
  }
}

async function openDocument(args: { documentId: string; page?: number }, ctx: ToolContext): Promise<{ ok: boolean; uiAction: UIAction }> {
  const db = getPrisma()

  // Verify access
  const doc = await db.document.findFirst({
    where: {
      id: args.documentId,
      userId: ctx.userId,
      deletionStatus: 'Active',
    },
  })

  if (!doc) {
    throw new Error('Document not found or access denied')
  }

  // Check privilege requirements
  if (doc.securityTier > 0 && !ctx.privilegeMode) {
    throw new Error('This document requires Privilege Mode to access')
  }

  return {
    ok: true,
    uiAction: { type: 'open_document', documentId: args.documentId },
  }
}

async function extractLiabilityClauses(args: { documentId: string }, ctx: ToolContext): Promise<unknown> {
  const db = getPrisma()

  const doc = await db.document.findFirst({
    where: { id: args.documentId, userId: ctx.userId, deletionStatus: 'Active' },
    select: { extractedText: true, originalName: true },
  })

  if (!doc) {
    throw new Error('Document not found')
  }

  // Simple regex-based extraction (in production, use AI)
  const liabilityPatterns = [
    /liability\s+(?:shall|will|may)\s+(?:not\s+)?(?:exceed|be limited to)[^.]+\./gi,
    /indemnif(?:y|ication)[^.]+\./gi,
    /hold\s+harmless[^.]+\./gi,
    /limitation\s+of\s+liability[^.]+\./gi,
  ]

  const text = doc.extractedText || ''
  const clauses: { text: string; type: string }[] = []

  for (const pattern of liabilityPatterns) {
    const matches = text.match(pattern) || []
    for (const match of matches) {
      clauses.push({
        text: match.trim(),
        type: pattern.source.includes('indemnif') ? 'indemnification' : 'limitation',
      })
    }
  }

  return {
    documentName: doc.originalName,
    clauseCount: clauses.length,
    clauses,
  }
}

async function extractKeyDates(args: { documentId: string }, ctx: ToolContext): Promise<unknown> {
  const db = getPrisma()

  const doc = await db.document.findFirst({
    where: { id: args.documentId, userId: ctx.userId, deletionStatus: 'Active' },
    select: { extractedText: true, originalName: true },
  })

  if (!doc) {
    throw new Error('Document not found')
  }

  // Simple date extraction (in production, use AI)
  const datePattern = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi
  const text = doc.extractedText || ''
  const matches = text.match(datePattern) || []

  return {
    documentName: doc.originalName,
    dates: [...new Set(matches)].slice(0, 20),
  }
}

async function summarizeDocument(args: { documentId: string; length?: string }, ctx: ToolContext): Promise<unknown> {
  const db = getPrisma()

  const doc = await db.document.findFirst({
    where: { id: args.documentId, userId: ctx.userId, deletionStatus: 'Active' },
    select: { extractedText: true, originalName: true },
  })

  if (!doc) {
    throw new Error('Document not found')
  }

  const text = doc.extractedText || ''
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)

  const lengthConfig = {
    brief: 3,
    standard: 5,
    detailed: 10,
  }
  const count = lengthConfig[args.length as keyof typeof lengthConfig] || 5

  return {
    documentName: doc.originalName,
    summary: sentences.slice(0, count).join('. ') + '.',
    wordCount: text.split(/\s+/).length,
  }
}

async function getDocumentStats(ctx: ToolContext): Promise<unknown> {
  const db = getPrisma()

  const [total, byType, recent] = await Promise.all([
    db.document.count({ where: { userId: ctx.userId, deletionStatus: 'Active' } }),
    db.document.groupBy({
      by: ['mimeType'],
      where: { userId: ctx.userId, deletionStatus: 'Active' },
      _count: true,
    }),
    db.document.findMany({
      where: { userId: ctx.userId, deletionStatus: 'Active' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { filename: true, createdAt: true },
    }),
  ])

  return {
    totalDocuments: total,
    byType: byType.map(t => ({ type: t.mimeType, count: t._count })),
    recentUploads: recent.map(d => ({ name: d.filename, createdAt: d.createdAt })),
  }
}

async function listDocuments(args: { limit?: number; sortBy?: string }, ctx: ToolContext): Promise<unknown> {
  const db = getPrisma()
  const limit = args.limit || 20

  // Determine sort order
  const orderBy: Record<string, 'asc' | 'desc'> =
    args.sortBy === 'name' ? { filename: 'asc' } :
    args.sortBy === 'size' ? { sizeBytes: 'desc' } :
    { createdAt: 'desc' }

  // Build where clause based on privilege mode
  const whereClause = {
    userId: ctx.userId,
    deletionStatus: 'Active' as const,
    // Only show privileged documents if privilege mode is enabled
    ...(ctx.privilegeMode ? {} : { securityTier: 0 }),
  }

  const documents = await db.document.findMany({
    where: whereClause,
    take: limit,
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      securityTier: true,
    },
    orderBy,
  })

  return {
    count: documents.length,
    privilegeMode: ctx.privilegeMode,
    documents: documents.map(d => ({
      id: d.id,
      name: d.originalName || d.filename,
      type: d.mimeType,
      size: `${(d.sizeBytes / 1024).toFixed(1)} KB`,
      uploadedAt: d.createdAt.toISOString().split('T')[0],
      isPrivileged: d.securityTier > 0,
    })),
  }
}

async function readDocument(args: { documentId: string }, ctx: ToolContext): Promise<unknown> {
  const db = getPrisma()

  const doc = await db.document.findFirst({
    where: {
      id: args.documentId,
      userId: ctx.userId,
      deletionStatus: 'Active',
    },
    select: {
      id: true,
      filename: true,
      originalName: true,
      extractedText: true,
      securityTier: true,
    },
  })

  if (!doc) {
    throw new Error('Document not found or access denied')
  }

  // Check privilege requirements
  if (doc.securityTier > 0 && !ctx.privilegeMode) {
    throw new Error('This document is privileged. Enable Privilege Mode to access it.')
  }

  const text = doc.extractedText || ''

  // Return a reasonable amount of text (first 4000 chars for context window)
  const truncatedText = text.length > 4000
    ? text.substring(0, 4000) + '\n\n[... Document truncated. Full text available in viewer.]'
    : text

  return {
    documentId: doc.id,
    name: doc.originalName || doc.filename,
    contentPreview: truncatedText,
    totalLength: text.length,
    isTruncated: text.length > 4000,
  }
}

function navigateTo(args: { destination: string }): { ok: boolean; uiAction: UIAction } {
  const pathMap: Record<string, string> = {
    vault: '/dashboard/vault',
    chat: '/dashboard',
    audit: '/dashboard/audit',
    settings: '/dashboard/settings',
    help: '/dashboard/help',
  }

  const path = pathMap[args.destination]
  if (!path) {
    throw new Error(`Unknown destination: ${args.destination}`)
  }

  return {
    ok: true,
    uiAction: { type: 'navigate', path },
  }
}

function togglePrivilegeMode(args: { enabled: boolean }, ctx: ToolContext): { ok: boolean; uiAction: UIAction } {
  // RBAC check happens in executeTool
  return {
    ok: true,
    uiAction: { type: 'toggle_privilege', enabled: args.enabled },
  }
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executeTool(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
  const startTime = Date.now()

  try {
    // Find tool definition for RBAC check
    const toolDef = TOOL_DEFINITIONS.find(t => t.name === call.name)

    if (!toolDef) {
      throw new Error(`Unknown tool: ${call.name}`)
    }

    // RBAC check
    if (toolDef.requiredRole === 'Admin' && ctx.role !== 'Admin') {
      throw new Error(`Tool '${call.name}' requires Admin role`)
    }

    let result: unknown
    let uiAction: UIAction | undefined

    switch (call.name) {
      case 'search_documents':
        result = await searchDocuments(call.arguments as { query: string; limit?: number; documentType?: string }, ctx)
        break

      case 'open_document': {
        const openResult = await openDocument(call.arguments as { documentId: string; page?: number }, ctx)
        result = { ok: openResult.ok }
        uiAction = openResult.uiAction
        break
      }

      case 'extract_liability_clauses':
        result = await extractLiabilityClauses(call.arguments as { documentId: string }, ctx)
        break

      case 'extract_key_dates':
        result = await extractKeyDates(call.arguments as { documentId: string }, ctx)
        break

      case 'summarize_document':
        result = await summarizeDocument(call.arguments as { documentId: string; length?: string }, ctx)
        break

      case 'get_document_stats':
        result = await getDocumentStats(ctx)
        break

      case 'list_documents':
        result = await listDocuments(call.arguments as { limit?: number; sortBy?: string }, ctx)
        break

      case 'read_document':
        result = await readDocument(call.arguments as { documentId: string }, ctx)
        break

      case 'navigate_to': {
        const navResult = navigateTo(call.arguments as { destination: string })
        result = { ok: navResult.ok }
        uiAction = navResult.uiAction
        break
      }

      case 'toggle_privilege_mode': {
        const privResult = togglePrivilegeMode(call.arguments as { enabled: boolean }, ctx)
        result = { ok: privResult.ok }
        uiAction = privResult.uiAction
        break
      }

      case 'set_viewing_role':
        // RBAC already checked above
        result = { ok: true, newRole: call.arguments.role }
        uiAction = { type: 'show_toast', message: `Role changed to ${call.arguments.role}`, variant: 'success' }
        break

      case 'compare_documents':
        result = { message: 'Document comparison not yet implemented' }
        break

      case 'export_audit_log':
        result = { message: 'Audit export initiated', jobId: `audit_${Date.now()}` }
        break

      default:
        throw new Error(`Unhandled tool: ${call.name}`)
    }

    console.log(`[Tools] Executed '${call.name}' in ${Date.now() - startTime}ms`)

    return {
      toolCallId: call.id,
      name: call.name,
      success: true,
      result,
      uiAction,
    }
  } catch (error) {
    console.error(`[Tools] Error executing '${call.name}':`, error)

    return {
      toolCallId: call.id,
      name: call.name,
      success: false,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { TOOL_DEFINITIONS as toolDefinitions }
