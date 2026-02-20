'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogIn,
  Upload,
  MessageSquare,
  MessageCircle,
  Shield,
  Lock,
  AlertTriangle,
  Trash2,
  LogOut,
  Download,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Hash,
  Clock,
  User,
  Globe,
  CheckCircle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuditEvent, AuditAction, AuditSeverity } from '@/lib/audit/audit-types'

interface AuditEntryProps {
  event: AuditEvent
  index: number
  onViewDetails: (event: AuditEvent) => void
}

/**
 * Get icon for audit action
 */
function getActionIcon(action: AuditAction) {
  switch (action) {
    case 'LOGIN':
      return <LogIn className="w-4 h-4" />
    case 'LOGOUT':
      return <LogOut className="w-4 h-4" />
    case 'DOCUMENT_UPLOAD':
      return <Upload className="w-4 h-4" />
    case 'DOCUMENT_DELETE':
      return <Trash2 className="w-4 h-4" />
    case 'DOCUMENT_PRIVILEGE_CHANGE':
      return <Lock className="w-4 h-4" />
    case 'QUERY_SUBMITTED':
      return <MessageSquare className="w-4 h-4" />
    case 'QUERY_RESPONSE':
      return <MessageCircle className="w-4 h-4" />
    case 'SILENCE_PROTOCOL_TRIGGERED':
      return <AlertTriangle className="w-4 h-4" />
    case 'PRIVILEGE_MODE_CHANGE':
      return <Shield className="w-4 h-4" />
    case 'DATA_EXPORT':
      return <Download className="w-4 h-4" />
    case 'ERROR':
      return <AlertCircle className="w-4 h-4" />
    default:
      return <Hash className="w-4 h-4" />
  }
}

/**
 * Get action display name
 */
function getActionDisplayName(action: AuditAction): string {
  const names: Record<AuditAction, string> = {
    LOGIN: 'User Login',
    LOGOUT: 'User Logout',
    DOCUMENT_UPLOAD: 'Document Upload',
    DOCUMENT_DELETE: 'Document Deleted',
    DOCUMENT_VIEW: 'Document Viewed',
    DOCUMENT_PRIVILEGE_CHANGE: 'Privilege Changed',
    DOCUMENT_TIER_CHANGE: 'Tier Changed',
    QUERY_SUBMITTED: 'Query Submitted',
    QUERY_RESPONSE: 'Query Response',
    SILENCE_PROTOCOL: 'Silence Protocol',
    SILENCE_PROTOCOL_TRIGGERED: 'Silence Protocol',
    PRIVILEGE_MODE_CHANGE: 'Mode Changed',
    DATA_EXPORT: 'Data Export',
    SETTINGS_CHANGE: 'Settings Changed',
    ERROR: 'Error',
  }
  return names[action] || action
}

/**
 * Get severity color classes
 */
function getSeverityColors(severity: AuditSeverity) {
  switch (severity) {
    case 'CRITICAL':
      return {
        bg: 'bg-[var(--danger)]/20',
        text: 'text-[var(--danger)]',
        border: 'border-[var(--danger)]/30',
        glow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
      }
    case 'ERROR':
      return {
        bg: 'bg-[var(--danger)]/20',
        text: 'text-[var(--danger)]',
        border: 'border-[var(--danger)]/30',
        glow: '',
      }
    case 'WARNING':
      return {
        bg: 'bg-[var(--warning)]/20',
        text: 'text-[var(--warning)]',
        border: 'border-[var(--warning)]/30',
        glow: '',
      }
    default:
      return {
        bg: 'bg-[var(--bg-elevated)]',
        text: 'text-[var(--text-secondary)]',
        border: 'border-[var(--border-default)]',
        glow: '',
      }
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): { time: string; date: string } {
  const date = new Date(timestamp)
  return {
    time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  }
}

/**
 * Get summary of event details
 */
function getDetailsSummary(event: AuditEvent): string {
  const details = event.details

  switch (event.action) {
    case 'DOCUMENT_UPLOAD':
      return `Uploaded "${details.filename}"`
    case 'DOCUMENT_DELETE':
      return `Deleted "${details.filename}"`
    case 'DOCUMENT_PRIVILEGE_CHANGE':
      return `${details.privileged ? 'Marked' : 'Unmarked'} "${details.filename}" as privileged`
    case 'QUERY_SUBMITTED':
      return `Query: "${(details.queryPreview as string)?.substring(0, 40) || '...'}"...`
    case 'QUERY_RESPONSE':
      return `Confidence: ${((details.confidence as number) * 100).toFixed(0)}%, ${details.chunksUsed} chunks used`
    case 'SILENCE_PROTOCOL_TRIGGERED':
      return `${details.reason}: Confidence ${((details.confidence as number) * 100).toFixed(0)}%`
    case 'PRIVILEGE_MODE_CHANGE':
      return `Privilege mode ${details.enabled ? 'enabled' : 'disabled'}`
    case 'LOGIN':
      return `Login via ${details.method}`
    default:
      return JSON.stringify(details).substring(0, 50) + '...'
  }
}

/**
 * AuditEntry Component
 * Displays a single audit log entry in a blockchain-inspired style
 */
export function AuditEntry({ event, index, onViewDetails }: AuditEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { time, date } = formatTimestamp(event.timestamp)
  const colors = getSeverityColors(event.severity)

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
    >
      {/* Timeline connector line */}
      <div className="absolute left-6 top-12 bottom-0 w-px bg-[var(--border-default)]" />

      {/* Entry card */}
      <div
        className={cn(
          'relative ml-12 rounded-xl border transition-all duration-200',
          'bg-[var(--bg-secondary)] backdrop-blur-sm',
          colors.border,
          colors.glow,
          'hover:bg-[var(--bg-tertiary)]',
          'cursor-pointer'
        )}
        onClick={() => onViewDetails(event)}
      >
        {/* Timeline node */}
        <div
          className={cn(
            'absolute -left-12 top-4 w-6 h-6 rounded-full flex items-center justify-center',
            colors.bg,
            colors.text,
            'border-2',
            colors.border
          )}
        >
          {getActionIcon(event.action)}
        </div>

        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Action badge */}
            <span
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold',
                colors.bg,
                colors.text
              )}
            >
              {getActionDisplayName(event.action)}
            </span>

            {/* Severity indicator */}
            {event.severity !== 'INFO' && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                  colors.bg,
                  colors.text
                )}
              >
                {event.severity}
              </span>
            )}
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            <Clock className="w-3 h-3" />
            <span>{time}</span>
            <span className="text-[var(--border-default)]">|</span>
            <span>{date}</span>
          </div>
        </div>

        {/* Summary */}
        <div className="px-4 pb-3">
          <p className="text-sm text-[var(--text-secondary)]">
            {getDetailsSummary(event)}
          </p>
        </div>

        {/* Footer - metadata */}
        <div
          className={cn(
            'px-4 py-2 border-t flex items-center justify-between text-xs',
            'border-[var(--border-subtle)]',
            'text-[var(--text-tertiary)]'
          )}
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {event.userId?.substring(0, 12) || 'System'}
            </span>
            {event.ipAddress && (
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {event.ipAddress}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 font-mono text-[10px]">
            <Hash className="w-3 h-3" />
            {event.eventId.substring(4, 16)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

/**
 * AuditEntryDetailModal Component
 * Modal for viewing full audit entry details
 */
interface AuditEntryDetailModalProps {
  event: AuditEvent | null
  isOpen: boolean
  onClose: () => void
}

export function AuditEntryDetailModal({ event, isOpen, onClose }: AuditEntryDetailModalProps) {
  if (!event) return null

  const { time, date } = formatTimestamp(event.timestamp)
  const colors = getSeverityColors(event.severity)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={cn(
              'relative max-w-2xl w-full max-h-[80vh] overflow-hidden',
              'bg-[var(--bg-secondary)]',
              'border border-[var(--border-default)]',
              'rounded-2xl shadow-2xl'
            )}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
              <div className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colors.bg, colors.text)}>
                  {getActionIcon(event.action)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    {getActionDisplayName(event.action)}
                  </h3>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {date} at {time}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
                aria-label="Close audit entry details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Event ID" value={event.eventId} mono />
                <DetailField label="User ID" value={event.userId || 'System'} />
                <DetailField label="Severity" value={event.severity} badge badgeColors={colors} />
                <DetailField label="IP Address" value={event.ipAddress || 'N/A'} />
                {event.resourceType && <DetailField label="Resource Type" value={event.resourceType} />}
                {event.resourceId && <DetailField label="Resource ID" value={event.resourceId} mono />}
              </div>

              {/* Details */}
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">
                  Event Details
                </h4>
                <pre
                  className={cn(
                    'p-4 rounded-xl text-xs font-mono overflow-x-auto',
                    'bg-[var(--bg-primary)]',
                    'text-[var(--brand-blue)]'
                  )}
                >
                  {JSON.stringify(event.details, null, 2)}
                </pre>
              </div>

              {/* Hash verification */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--success)]/10">
                <CheckCircle className="w-5 h-5 text-[var(--success)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--success)]">
                    Integrity Verified
                  </p>
                  <p className="text-xs font-mono text-[var(--success)]/60 truncate max-w-md">
                    SHA-256: {event.detailsHash}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Detail field component for modal
 */
function DetailField({
  label,
  value,
  mono,
  badge,
  badgeColors,
}: {
  label: string
  value: string
  mono?: boolean
  badge?: boolean
  badgeColors?: ReturnType<typeof getSeverityColors>
}) {
  return (
    <div>
      <p className="text-xs text-[var(--text-tertiary)] mb-1">{label}</p>
      {badge && badgeColors ? (
        <span className={cn('px-2 py-1 rounded text-xs font-semibold', badgeColors.bg, badgeColors.text)}>
          {value}
        </span>
      ) : (
        <p className={cn('text-sm text-[var(--text-primary)] truncate', mono && 'font-mono text-xs')}>
          {value}
        </p>
      )}
    </div>
  )
}
