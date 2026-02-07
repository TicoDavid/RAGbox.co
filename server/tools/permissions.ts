/**
 * Tool Permissions & Safety - RAGbox.co
 *
 * Per-user tool permissions and confirmation requirements.
 */

import type { ToolContext } from './index'

// ============================================================================
// TYPES
// ============================================================================

export interface ToolPermission {
  allowed: boolean
  requiresConfirmation: boolean
  reason?: string
}

export interface ConfirmationRequest {
  toolCallId: string
  toolName: string
  message: string
  severity: 'low' | 'medium' | 'high'
  expiresAt: number
}

// ============================================================================
// RISKY TOOLS (require confirmation)
// ============================================================================

const RISKY_TOOLS: Record<string, { severity: 'low' | 'medium' | 'high'; message: string }> = {
  toggle_privilege_mode: {
    severity: 'high',
    message: 'Enable Privilege Mode? This grants access to restricted documents.',
  },
  set_viewing_role: {
    severity: 'high',
    message: 'Change your viewing role? This affects your access level.',
  },
  export_audit_log: {
    severity: 'medium',
    message: 'Export the audit log? This creates a compliance record.',
  },
  compare_documents: {
    severity: 'low',
    message: 'Compare these documents? This may take a moment.',
  },
}

// ============================================================================
// ROLE-BASED PERMISSIONS
// ============================================================================

const ROLE_PERMISSIONS: Record<string, string[]> = {
  Viewer: [
    'search_documents',
    'get_document_stats',
    'navigate_to',
  ],
  User: [
    'search_documents',
    'open_document',
    'summarize_document',
    'extract_liability_clauses',
    'extract_key_dates',
    'get_document_stats',
    'navigate_to',
  ],
  Admin: [
    // Admins get everything
    '*',
  ],
}

// ============================================================================
// PERMISSION CHECKS
// ============================================================================

/**
 * Check if a user can execute a tool
 */
export function checkToolPermission(toolName: string, ctx: ToolContext): ToolPermission {
  const allowedTools = ROLE_PERMISSIONS[ctx.role] || []

  // Admins can do everything
  if (allowedTools.includes('*')) {
    const riskyConfig = RISKY_TOOLS[toolName]
    return {
      allowed: true,
      requiresConfirmation: !!riskyConfig,
      reason: riskyConfig?.message,
    }
  }

  // Check if tool is in allowed list
  if (!allowedTools.includes(toolName)) {
    return {
      allowed: false,
      requiresConfirmation: false,
      reason: `Tool '${toolName}' requires ${toolName.includes('privilege') || toolName.includes('role') ? 'Admin' : 'User'} role`,
    }
  }

  // Check if tool requires confirmation
  const riskyConfig = RISKY_TOOLS[toolName]
  return {
    allowed: true,
    requiresConfirmation: !!riskyConfig,
    reason: riskyConfig?.message,
  }
}

/**
 * Create a confirmation request for risky tools
 */
export function createConfirmationRequest(
  toolCallId: string,
  toolName: string
): ConfirmationRequest | null {
  const config = RISKY_TOOLS[toolName]
  if (!config) return null

  return {
    toolCallId,
    toolName,
    message: config.message,
    severity: config.severity,
    expiresAt: Date.now() + 30_000, // 30 second timeout
  }
}

// ============================================================================
// PENDING CONFIRMATIONS STORE
// ============================================================================

const pendingConfirmations = new Map<string, ConfirmationRequest>()

export function storePendingConfirmation(request: ConfirmationRequest): void {
  pendingConfirmations.set(request.toolCallId, request)

  // Auto-cleanup after expiry
  setTimeout(() => {
    pendingConfirmations.delete(request.toolCallId)
  }, 35_000)
}

export function getPendingConfirmation(toolCallId: string): ConfirmationRequest | undefined {
  const request = pendingConfirmations.get(toolCallId)
  if (request && Date.now() > request.expiresAt) {
    pendingConfirmations.delete(toolCallId)
    return undefined
  }
  return request
}

export function confirmToolCall(toolCallId: string): boolean {
  const exists = pendingConfirmations.has(toolCallId)
  pendingConfirmations.delete(toolCallId)
  return exists
}

export function denyToolCall(toolCallId: string): boolean {
  const exists = pendingConfirmations.has(toolCallId)
  pendingConfirmations.delete(toolCallId)
  return exists
}
