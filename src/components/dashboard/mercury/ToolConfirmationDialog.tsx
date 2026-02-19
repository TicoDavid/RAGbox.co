'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Shield, FileText, Check, X, Mic, Mail, MessageSquare, Send } from 'lucide-react'
import { useMercuryStore } from '@/stores/mercuryStore'

// ============================================================================
// TYPES
// ============================================================================

export interface ConfirmationRequest {
  toolCallId: string
  toolName: string
  message: string
  severity: 'low' | 'medium' | 'high'
  expiresAt: number
}

interface ToolConfirmationDialogProps {
  request: ConfirmationRequest | null
  onConfirm: (toolCallId: string) => void
  onDeny: (toolCallId: string) => void
  /** Enable voice confirmation ("confirm" / "cancel") */
  voiceEnabled?: boolean
}

// ============================================================================
// SEVERITY CONFIG
// ============================================================================

const SEVERITY_CONFIG = {
  low: {
    icon: FileText,
    color: 'text-[var(--brand-blue)]',
    bg: 'bg-[var(--brand-blue)]/10',
    border: 'border-[var(--brand-blue)]/30',
    glow: '',
  },
  medium: {
    icon: AlertTriangle,
    color: 'text-[var(--warning)]',
    bg: 'bg-[var(--warning)]/10',
    border: 'border-[var(--warning)]/30',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.2)]',
  },
  high: {
    icon: Shield,
    color: 'text-[var(--danger)]',
    bg: 'bg-[var(--danger)]/10',
    border: 'border-[var(--danger)]/30',
    glow: 'shadow-[0_0_30px_rgba(239,68,68,0.3)]',
  },
}

const AUTO_CANCEL_SECONDS = 30

// ============================================================================
// COUNTDOWN TIMER
// ============================================================================

function CountdownTimer({ expiresAt, onExpire }: { expiresAt: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))

  useEffect(() => {
    const interval = setInterval(() => {
      const r = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      setRemaining(r)
      if (r <= 0) {
        onExpire()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt, onExpire])

  return (
    <div className="text-xs text-[var(--text-tertiary)]">
      Auto-cancel in {remaining}s
    </div>
  )
}

// ============================================================================
// EMAIL CONFIRMATION CARD
// ============================================================================

function EmailConfirmationCard({
  payload,
  onConfirm,
  onDeny,
}: {
  payload: Record<string, unknown>
  onConfirm: () => void
  onDeny: () => void
}) {
  const [expiresAt] = useState(() => Date.now() + AUTO_CANCEL_SECONDS * 1000)
  const to = payload.to as string
  const subject = payload.subject as string
  const body = payload.body as string

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md mx-4 p-6 rounded-2xl border
                   border-[var(--warning)]/30 bg-[var(--bg-primary)]/95 backdrop-blur-xl
                   shadow-[0_0_30px_rgba(234,179,8,0.15)]"
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 rounded-xl bg-[var(--warning)]/10">
            <Mail className="w-6 h-6 text-[var(--warning)]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Send Email
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Review before sending
            </p>
          </div>
        </div>

        {/* Email Preview */}
        <div className="mb-5 space-y-3 p-4 rounded-lg bg-[var(--bg-primary)]/60 border border-[var(--border-default)]/50">
          <div className="flex items-start gap-2">
            <span className="text-xs font-medium text-[var(--text-tertiary)] w-14 shrink-0 pt-0.5">To</span>
            <span className="text-sm text-[var(--text-primary)] break-all">{to}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs font-medium text-[var(--text-tertiary)] w-14 shrink-0 pt-0.5">Subject</span>
            <span className="text-sm text-[var(--text-primary)]">{subject}</span>
          </div>
          <div className="border-t border-[var(--border-default)]/50 pt-3">
            <span className="text-xs font-medium text-[var(--text-tertiary)] block mb-1">Body</span>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
              {body.length > 300 ? `${body.slice(0, 300)}...` : body}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <CountdownTimer expiresAt={expiresAt} onExpire={onDeny} />

          <div className="flex gap-3">
            <button
              onClick={onDeny}
              className="px-4 py-2 rounded-lg text-sm font-medium
                       text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                       bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)]
                       transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg text-sm font-medium
                        text-[var(--text-primary)] transition-all flex items-center gap-2
                        bg-[var(--warning)] hover:bg-[var(--warning)]"
            >
              <Send className="w-4 h-4" />
              Send Email
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ============================================================================
// SMS CONFIRMATION CARD
// ============================================================================

function SmsConfirmationCard({
  payload,
  onConfirm,
  onDeny,
}: {
  payload: Record<string, unknown>
  onConfirm: () => void
  onDeny: () => void
}) {
  const [expiresAt] = useState(() => Date.now() + AUTO_CANCEL_SECONDS * 1000)
  const to = payload.to as string
  const body = payload.body as string
  const charCount = body.length
  const isOverLimit = charCount > 160

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md mx-4 p-6 rounded-2xl border
                   border-[var(--brand-blue)]/30 bg-[var(--bg-primary)]/95 backdrop-blur-xl
                   shadow-[0_0_30px_rgba(6,182,212,0.15)]"
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 rounded-xl bg-[var(--brand-blue)]/10">
            <MessageSquare className="w-6 h-6 text-[var(--brand-blue)]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Send SMS
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Review before sending
            </p>
          </div>
        </div>

        {/* SMS Preview */}
        <div className="mb-5 space-y-3 p-4 rounded-lg bg-[var(--bg-primary)]/60 border border-[var(--border-default)]/50">
          <div className="flex items-start gap-2">
            <span className="text-xs font-medium text-[var(--text-tertiary)] w-10 shrink-0 pt-0.5">To</span>
            <span className="text-sm text-[var(--text-primary)] font-mono">{to}</span>
          </div>
          <div className="border-t border-[var(--border-default)]/50 pt-3">
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
              {body}
            </p>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className={`text-xs ${isOverLimit ? 'text-[var(--warning)]' : 'text-[var(--text-tertiary)]'}`}>
              {charCount} character{charCount !== 1 ? 's' : ''}
            </span>
            {isOverLimit && (
              <span className="text-xs text-[var(--warning)]">
                May be split into multiple messages
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <CountdownTimer expiresAt={expiresAt} onExpire={onDeny} />

          <div className="flex gap-3">
            <button
              onClick={onDeny}
              className="px-4 py-2 rounded-lg text-sm font-medium
                       text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                       bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)]
                       transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg text-sm font-medium
                        text-[var(--text-primary)] transition-all flex items-center gap-2
                        bg-[var(--brand-blue)] hover:bg-[var(--brand-blue)]"
            >
              <Send className="w-4 h-4" />
              Send SMS
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ============================================================================
// ACTION CONFIRMATION OVERLAY
// ============================================================================

export function ActionConfirmationOverlay() {
  const pendingConfirmation = useMercuryStore((s) => s.pendingConfirmation)
  const confirmAction = useMercuryStore((s) => s.confirmAction)
  const denyAction = useMercuryStore((s) => s.denyAction)

  if (!pendingConfirmation) return null

  return (
    <AnimatePresence>
      {pendingConfirmation.type === 'send_email' && (
        <EmailConfirmationCard
          payload={pendingConfirmation.payload}
          onConfirm={confirmAction}
          onDeny={denyAction}
        />
      )}
      {pendingConfirmation.type === 'send_sms' && (
        <SmsConfirmationCard
          payload={pendingConfirmation.payload}
          onConfirm={confirmAction}
          onDeny={denyAction}
        />
      )}
    </AnimatePresence>
  )
}

// ============================================================================
// GENERIC TOOL CONFIRMATION (Original)
// ============================================================================

export function ToolConfirmationDialog({
  request,
  onConfirm,
  onDeny,
  voiceEnabled = false,
}: ToolConfirmationDialogProps) {
  const [isListening, setIsListening] = useState(false)
  const [voiceText, setVoiceText] = useState('')

  // Handle voice confirmation
  useEffect(() => {
    if (!voiceEnabled || !request || !isListening) return

    // Use SpeechRecognition for voice confirmation
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('')
        .toLowerCase()
        .trim()

      setVoiceText(transcript)

      // Check for confirmation keywords
      if (transcript.includes('confirm') || transcript.includes('yes') || transcript.includes('proceed')) {
        recognition.stop()
        setIsListening(false)
        onConfirm(request.toolCallId)
      } else if (transcript.includes('cancel') || transcript.includes('no') || transcript.includes('deny')) {
        recognition.stop()
        setIsListening(false)
        onDeny(request.toolCallId)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()

    return () => {
      recognition.stop()
    }
  }, [voiceEnabled, request, isListening, onConfirm, onDeny])

  const handleExpire = useCallback(() => {
    if (request) {
      onDeny(request.toolCallId)
    }
  }, [request, onDeny])

  if (!request) return null

  const config = SEVERITY_CONFIG[request.severity]
  const Icon = config.icon

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`
            w-full max-w-md mx-4 p-6 rounded-2xl
            ${config.bg} ${config.border} ${config.glow}
            border bg-[var(--bg-primary)]/95 backdrop-blur-xl
          `}
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-xl ${config.bg}`}>
              <Icon className={`w-6 h-6 ${config.color}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                Confirm Action
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {request.toolName.replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          {/* Message */}
          <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
            {request.message}
          </p>

          {/* Voice confirmation status */}
          {voiceEnabled && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)]">
              <div className="flex items-center gap-2 mb-2">
                {isListening ? (
                  <>
                    <Mic className="w-4 h-4 text-[var(--brand-blue)] animate-pulse" />
                    <span className="text-sm text-[var(--brand-blue)]">Listening...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-[var(--text-tertiary)]" />
                    <span className="text-sm text-[var(--text-tertiary)]">Say &quot;confirm&quot; or &quot;cancel&quot;</span>
                  </>
                )}
              </div>
              {voiceText && (
                <p className="text-xs text-[var(--text-secondary)] italic">&quot;{voiceText}&quot;</p>
              )}
              {!isListening && (
                <button
                  onClick={() => setIsListening(true)}
                  className="mt-2 text-xs text-[var(--brand-blue)] hover:text-[var(--brand-blue)]"
                >
                  Click to speak
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <CountdownTimer expiresAt={request.expiresAt} onExpire={handleExpire} />

            <div className="flex gap-3">
              <button
                onClick={() => onDeny(request.toolCallId)}
                className="px-4 py-2 rounded-lg text-sm font-medium
                         text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                         bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)]
                         transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={() => onConfirm(request.toolCallId)}
                className={`px-4 py-2 rounded-lg text-sm font-medium
                          text-[var(--text-primary)] transition-all flex items-center gap-2
                          ${request.severity === 'high'
                            ? 'bg-[var(--danger)] hover:bg-[var(--danger)]'
                            : request.severity === 'medium'
                            ? 'bg-[var(--warning)] hover:bg-[var(--warning)]'
                            : 'bg-[var(--brand-blue)] hover:bg-[var(--brand-blue)]'
                          }`}
              >
                <Check className="w-4 h-4" />
                Confirm
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ToolConfirmationDialog
