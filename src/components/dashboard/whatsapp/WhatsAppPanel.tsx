'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Search,
  Send,
  MessageCircle,
  Phone,
  ToggleLeft,
  ToggleRight,
  Bot,
  User,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { useWhatsAppStore, type WhatsAppConversation, type WhatsAppMessage } from '@/stores/whatsappStore'

// ============================================================================
// MAIN PANEL
// ============================================================================

const POLL_CONVERSATIONS_MS = 15_000
const POLL_MESSAGES_MS = 8_000

export function WhatsAppPanel() {
  const activeConversationId = useWhatsAppStore((s) => s.activeConversationId)
  const setActiveConversation = useWhatsAppStore((s) => s.setActiveConversation)
  const fetchConversations = useWhatsAppStore((s) => s.fetchConversations)
  const fetchMessages = useWhatsAppStore((s) => s.fetchMessages)

  // Initial fetch + poll conversations list
  useEffect(() => {
    fetchConversations()
    const id = setInterval(fetchConversations, POLL_CONVERSATIONS_MS)
    return () => clearInterval(id)
  }, [fetchConversations])

  // Poll active conversation messages
  useEffect(() => {
    if (!activeConversationId) return
    const id = setInterval(() => fetchMessages(activeConversationId), POLL_MESSAGES_MS)
    return () => clearInterval(id)
  }, [activeConversationId, fetchMessages])

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      <AnimatePresence mode="wait">
        {activeConversationId ? (
          <motion.div
            key="thread"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full flex flex-col"
          >
            <WhatsAppThread
              conversationId={activeConversationId}
              onBack={() => setActiveConversation(null)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full flex flex-col"
          >
            <WhatsAppContactList />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// CONTACT LIST
// ============================================================================

function WhatsAppContactList() {
  const conversations = useWhatsAppStore((s) => s.conversations)
  const setActiveConversation = useWhatsAppStore((s) => s.setActiveConversation)
  const isLoading = useWhatsAppStore((s) => s.isLoading)
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = searchQuery
    ? conversations.filter((c) => {
        const name = c.contact.displayName || c.contact.phoneNumber
        return name.toLowerCase().includes(searchQuery.toLowerCase())
      })
    : conversations

  return (
    <>
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-[var(--success)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">
            WhatsApp
          </h3>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg
                     bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)]
                     text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]
                     focus:outline-none focus:ring-1 focus:ring-[var(--success)]/30 focus:border-[var(--success)]/30"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center">
            <div className="w-5 h-5 border-2 border-[var(--success)]/30 border-t-[var(--success)] rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[var(--text-tertiary)] mt-2">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="w-12 h-12 text-[var(--success)]/20 mx-auto mb-3" />
            <p className="text-sm text-[var(--text-tertiary)]">No conversations yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Messages from WhatsApp will appear here
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filtered.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                onClick={() => setActiveConversation(conversation.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ============================================================================
// CONVERSATION ITEM
// ============================================================================

function ConversationItem({
  conversation,
  onClick,
}: {
  conversation: WhatsAppConversation
  onClick: () => void
}) {
  const name = conversation.contact.displayName || conversation.contact.phoneNumber
  const initials = name.charAt(0).toUpperCase()
  const time = conversation.lastMessageAt
    ? formatRelativeTime(new Date(conversation.lastMessageAt))
    : ''

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3
                 hover:bg-[var(--bg-elevated)]/50 transition-colors text-left"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-[var(--success)]/20 flex items-center justify-center shrink-0">
        <span className="text-sm font-semibold text-[var(--success)]">{initials}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">{name}</span>
          <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 ml-2">{time}</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
          {conversation.lastMessageText || 'No messages'}
        </p>
      </div>

      {/* Unread Badge */}
      {conversation.unreadCount > 0 && (
        <div className="w-5 h-5 rounded-full bg-[var(--success)] flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-[var(--text-primary)]">
            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
          </span>
        </div>
      )}
    </button>
  )
}

// ============================================================================
// THREAD VIEW
// ============================================================================

function WhatsAppThread({
  conversationId,
  onBack,
}: {
  conversationId: string
  onBack: () => void
}) {
  const conversations = useWhatsAppStore((s) => s.conversations)
  const messages = useWhatsAppStore((s) => s.messages[conversationId] || [])
  const toggleAutoReply = useWhatsAppStore((s) => s.toggleAutoReply)

  const conversation = conversations.find((c) => c.id === conversationId)
  const contactName = conversation?.contact?.displayName || conversation?.contact?.phoneNumber || 'Unknown'

  // Guard: conversation may have been deleted/archived while this thread was open
  if (!conversation) {
    return (
      <>
        <div className="shrink-0 px-3 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <p className="text-sm text-[var(--text-tertiary)]">Conversation not found</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-[var(--warning)]/30 mx-auto mb-2" />
            <p className="text-sm text-[var(--text-tertiary)]">This conversation is no longer available.</p>
            <button
              onClick={onBack}
              className="mt-3 px-4 py-2 text-xs rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Back to conversations
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Thread Header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg
                     text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-8 h-8 rounded-full bg-[var(--success)]/20 flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-[var(--success)]">
            {contactName.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{contactName}</p>
          <p className="text-[10px] text-[var(--text-tertiary)]">
            {conversation.contact?.phoneNumber}
          </p>
        </div>

        {/* Auto-Reply Toggle */}
        <button
          onClick={() => toggleAutoReply(conversationId)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-colors
            ${conversation.autoReply
              ? 'bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30'
              : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]'
            }`}
          title={conversation.autoReply ? 'Auto-reply ON' : 'Auto-reply OFF'}
        >
          {conversation.autoReply ? (
            <ToggleRight className="w-3 h-3" />
          ) : (
            <ToggleLeft className="w-3 h-3" />
          )}
          Auto
        </button>
      </div>

      {/* Messages */}
      <MessageList messages={messages} />

      {/* Input */}
      <WhatsAppInput conversationId={conversationId} />
    </>
  )
}

// ============================================================================
// MESSAGE LIST (mirrors ConversationThread scroll behavior)
// ============================================================================

function MessageList({ messages }: { messages: WhatsAppMessage[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    if (!userScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  const handleScroll = useCallback(() => {
    userScrolledUp.current = !isNearBottom()
  }, [isNearBottom])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <Phone className="w-10 h-10 text-[var(--success)]/20 mx-auto mb-2" />
          <p className="text-sm text-[var(--text-tertiary)]">No messages yet</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
    >
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

function MessageBubble({ message }: { message: WhatsAppMessage }) {
  const isInbound = message.direction === 'inbound'
  const isAutoReply = message.autoReply || (message.direction === 'outbound' && message.confidence != null)

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${
          isInbound
            ? 'bg-[var(--success)]/30 border border-[var(--success)]/20 rounded-tl-md'
            : 'bg-[var(--brand-blue)]/20 border border-[var(--brand-blue)]/20 rounded-tr-md'
        }`}
      >
        {/* Content */}
        <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">
          {message.content || `[${message.messageType}]`}
        </p>

        {/* Footer: time + status + confidence */}
        <div className={`flex items-center gap-1.5 mt-1 ${isInbound ? 'justify-start' : 'justify-end'}`}>
          {isAutoReply && (
            <span className="flex items-center gap-0.5 text-[9px] text-[var(--brand-blue)]">
              <Bot className="w-2.5 h-2.5" />
              Mercury
            </span>
          )}

          {message.confidence != null && (
            <span className={`text-[9px] px-1 py-0.5 rounded ${
              message.confidence >= 0.85
                ? 'bg-[var(--success)]/10 text-[var(--success)]'
                : message.confidence >= 0.5
                  ? 'bg-[var(--warning)]/10 text-[var(--warning)]'
                  : 'bg-[var(--danger)]/10 text-[var(--danger)]'
            }`}>
              {Math.round(message.confidence * 100)}%
            </span>
          )}

          <span className="text-[9px] text-[var(--text-muted)]">
            {formatTime(new Date(message.createdAt))}
          </span>

          {!isInbound && (
            <StatusIcon status={message.status} />
          )}
        </div>
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: WhatsAppMessage['status'] }) {
  switch (status) {
    case 'sent':
      return <Check className="w-2.5 h-2.5 text-[var(--text-tertiary)]" />
    case 'delivered':
      return <CheckCheck className="w-2.5 h-2.5 text-[var(--text-tertiary)]" />
    case 'read':
      return <CheckCheck className="w-2.5 h-2.5 text-[var(--brand-blue)]" />
    case 'failed':
      return <AlertCircle className="w-2.5 h-2.5 text-[var(--danger)]" />
    default:
      return <Clock className="w-2.5 h-2.5 text-[var(--text-muted)]" />
  }
}

// ============================================================================
// INPUT
// ============================================================================

function WhatsAppInput({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState('')
  const sendMessage = useWhatsAppStore((s) => s.sendMessage)
  const isSending = useWhatsAppStore((s) => s.isSending)

  const handleSend = async () => {
    if (!text.trim() || isSending) return
    const msg = text
    setText('')
    await sendMessage(conversationId, msg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="shrink-0 px-3 py-2.5 border-t border-[var(--border-subtle)]">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none rounded-xl px-3.5 py-2.5
                     bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)]
                     text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]
                     focus:outline-none focus:ring-1 focus:ring-[var(--success)]/30 focus:border-[var(--success)]/30
                     max-h-24"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || isSending}
          className="w-9 h-9 flex items-center justify-center rounded-xl
                     bg-[var(--success)] hover:bg-[var(--success)] text-[var(--text-primary)]
                     disabled:opacity-30 disabled:cursor-not-allowed
                     transition-colors shrink-0"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// HELPERS
// ============================================================================

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  if (diffHr < 24) return `${diffHr}h`
  if (diffDay < 7) return `${diffDay}d`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
