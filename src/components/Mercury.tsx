'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Settings, X, Flag, FileText, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRagSounds } from '@/hooks/useRagSounds'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  citations?: Citation[]
}

interface Citation {
  document: string
  page: number
  snippet: string
}

interface SuggestionChip {
  icon: React.ReactNode
  label: string
  prompt: string
}

const suggestionChips: SuggestionChip[] = [
  {
    icon: <Flag className="w-3.5 h-3.5" />,
    label: 'Flag Risk Factors',
    prompt: 'Identify and flag all potential risk factors in the uploaded documents',
  },
  {
    icon: <FileText className="w-3.5 h-3.5" />,
    label: 'Summarize this Contract',
    prompt: 'Provide a comprehensive summary of the key terms and obligations in this contract',
  },
  {
    icon: <Search className="w-3.5 h-3.5" />,
    label: 'Find Force Majeure',
    prompt: 'Locate and analyze all force majeure clauses in the documents',
  },
]

// Thinking state phases
const thinkingPhases = [
  'Reading Vector DB...',
  'Checking Privilege...',
  'Synthesizing...',
]

/**
 * Mercury Component - AI Concierge (Right Sidebar)
 *
 * Features:
 * - Glassmorphism design
 * - Pulsing green "Online" indicator
 * - Floating pill-shaped input
 * - Control Deck (Gemini-style settings)
 * - Suggestion chips in empty state
 * - Cycling thinking state animation
 * - Citation cards with hover highlight
 */
export function Mercury() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showControlDeck, setShowControlDeck] = useState(false)
  const [hoveredCitation, setHoveredCitation] = useState<string | null>(null)

  // Audio UI - The "RAG" Snap
  const { playSnapSound } = useRagSounds()

  // Control Deck state
  const [role, setRole] = useState('Legal Analyst')
  const [precision, setPrecision] = useState(70) // 0-100 slider
  const [deepAudit, setDeepAudit] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Simulate AI response with citations (to be replaced with actual API call)
    setTimeout(() => {
      // AUDIO UI: Play "The RAG Snap" - crisp whip crack
      playSnapSound()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          'Based on my analysis of the uploaded documents, I found several relevant sections that address your query. The confidentiality obligations outlined in Section 4.2 require all parties to maintain strict data protection protocols.',
        timestamp: new Date(),
        citations: [
          {
            document: 'Contract_NDA_2024.pdf',
            page: 3,
            snippet: 'Section 4.2 - Confidentiality obligations shall remain in effect for a period of five (5) years...',
          },
          {
            document: 'Contract_NDA_2024.pdf',
            page: 7,
            snippet: 'Article 8 - Data Protection: All confidential information must be stored in encrypted format...',
          },
        ],
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 3000) // Longer delay to show thinking animation
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChipClick = (prompt: string) => {
    setInput(prompt)
  }

  return (
    <motion.aside
      className={cn(
        'h-screen w-80 flex flex-col relative',
        'border-l',
        // Glassmorphism
        'dark:bg-void/80 dark:border-white/10',
        'bg-ceramic/80 border-black/5',
        'backdrop-blur-xl'
      )}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="p-4 border-b dark:border-white/10 border-black/5">
        <motion.div
          className="flex items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center',
              'dark:bg-electric-600/20 bg-electric-100'
            )}
          >
            <Sparkles className="w-5 h-5 text-electric-500" strokeWidth={2} />
          </div>
          <div className="flex-1 ml-3">
            <h2 className="font-bold dark:text-white text-black">Mercury</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-trust-high animate-pulse" />
              <span className="text-xs dark:text-white/40 text-black/40">
                AI Concierge Online
              </span>
            </div>
          </div>
          {/* Settings Toggle */}
          <motion.button
            onClick={() => setShowControlDeck(!showControlDeck)}
            className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center',
              'transition-colors duration-200',
              showControlDeck
                ? 'bg-electric-600 text-white'
                : 'dark:hover:bg-white/10 hover:bg-black/10 dark:text-white/60 text-black/60'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Settings className="w-4 h-4" strokeWidth={2} />
          </motion.button>
        </motion.div>
      </div>

      {/* Control Deck Slide-over */}
      <AnimatePresence>
        {showControlDeck && (
          <ControlDeck
            role={role}
            setRole={setRole}
            precision={precision}
            setPrecision={setPrecision}
            deepAudit={deepAudit}
            setDeepAudit={setDeepAudit}
            onClose={() => setShowControlDeck(false)}
          />
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <EmptyState onChipClick={handleChipClick} />
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                hoveredCitation={hoveredCitation}
                setHoveredCitation={setHoveredCitation}
              />
            ))}
            {isLoading && <ThinkingIndicator />}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4">
        <motion.div
          className={cn(
            'flex items-center gap-2',
            'p-2 rounded-3xl',
            'dark:bg-white/5 bg-black/5',
            'border dark:border-white/10 border-black/10'
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Mercury anything..."
            className={cn(
              'flex-1 bg-transparent px-4 py-2',
              'text-sm',
              'dark:text-white text-black',
              'dark:placeholder:text-white/30 placeholder:text-black/30',
              'focus:outline-none'
            )}
          />
          <motion.button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center',
              'transition-all duration-200',
              input.trim()
                ? cn(
                    'bg-electric-600 text-white',
                    'shadow-glow-sm hover:shadow-glow'
                  )
                : 'dark:bg-white/10 bg-black/10 dark:text-white/30 text-black/30'
            )}
            whileHover={input.trim() ? { scale: 1.05 } : {}}
            whileTap={input.trim() ? { scale: 0.95 } : {}}
          >
            <Send className="w-4 h-4" strokeWidth={2.5} />
          </motion.button>
        </motion.div>
      </div>
    </motion.aside>
  )
}

/**
 * Control Deck - Gemini-style settings panel
 */
function ControlDeck({
  role,
  setRole,
  precision,
  setPrecision,
  deepAudit,
  setDeepAudit,
  onClose,
}: {
  role: string
  setRole: (v: string) => void
  precision: number
  setPrecision: (v: number) => void
  deepAudit: boolean
  setDeepAudit: (v: boolean) => void
  onClose: () => void
}) {
  return (
    <motion.div
      className={cn(
        'absolute top-16 left-0 right-0 z-20',
        'mx-2 p-4 rounded-2xl',
        'dark:bg-void/95 bg-ceramic/95',
        'backdrop-blur-xl',
        'border dark:border-white/10 border-black/10',
        'shadow-2xl'
      )}
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold dark:text-white text-black">
          Control Deck
        </h3>
        <motion.button
          onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center dark:hover:bg-white/10 hover:bg-black/10 dark:text-white/60 text-black/60"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <X className="w-4 h-4" />
        </motion.button>
      </div>

      {/* Role Input */}
      <div className="mb-4">
        <label className="block text-xs font-medium dark:text-white/60 text-black/60 mb-2">
          Role
        </label>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g., Skeptical Auditor"
          className={cn(
            'w-full px-3 py-2 rounded-xl',
            'text-sm',
            'dark:bg-white/5 bg-black/5',
            'dark:text-white text-black',
            'dark:placeholder:text-white/30 placeholder:text-black/30',
            'border dark:border-white/10 border-black/10',
            'focus:outline-none focus:border-electric-500'
          )}
        />
      </div>

      {/* Precision Slider */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium dark:text-white/60 text-black/60">
            Precision
          </label>
          <span className="text-xs dark:text-electric-400 text-electric-600 font-mono">
            {precision}%
          </span>
        </div>
        <div className="relative">
          <input
            type="range"
            min="0"
            max="100"
            value={precision}
            onChange={(e) => setPrecision(Number(e.target.value))}
            className={cn(
              'w-full h-2 rounded-full appearance-none cursor-pointer',
              'dark:bg-white/10 bg-black/10',
              '[&::-webkit-slider-thumb]:appearance-none',
              '[&::-webkit-slider-thumb]:w-4',
              '[&::-webkit-slider-thumb]:h-4',
              '[&::-webkit-slider-thumb]:rounded-full',
              '[&::-webkit-slider-thumb]:bg-electric-500',
              '[&::-webkit-slider-thumb]:shadow-glow-sm',
              '[&::-webkit-slider-thumb]:cursor-pointer'
            )}
          />
          <div className="flex justify-between text-[10px] dark:text-white/30 text-black/30 mt-1">
            <span>Strict</span>
            <span>Creative</span>
          </div>
        </div>
      </div>

      {/* Audit Depth Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-medium dark:text-white/60 text-black/60">
            Audit Depth
          </label>
          <p className="text-[10px] dark:text-white/30 text-black/30">
            Deep Chain-of-Thought analysis
          </p>
        </div>
        <motion.button
          onClick={() => setDeepAudit(!deepAudit)}
          className={cn(
            'w-12 h-6 rounded-full p-1 transition-colors duration-200',
            deepAudit
              ? 'bg-electric-600'
              : 'dark:bg-white/10 bg-black/10'
          )}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            className="w-4 h-4 rounded-full bg-white shadow-md"
            animate={{ x: deepAudit ? 24 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </motion.button>
      </div>
    </motion.div>
  )
}

/**
 * Empty State - The Invitation
 */
function EmptyState({ onChipClick }: { onChipClick: (prompt: string) => void }) {
  return (
    <motion.div
      className="h-full flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
    >
      {/* Pulsing Mercury Icon */}
      <motion.div
        className={cn(
          'w-16 h-16 rounded-3xl flex items-center justify-center mb-4',
          'dark:bg-electric-600/20 bg-electric-100'
        )}
        animate={{
          boxShadow: [
            '0 0 0 0 rgba(37, 99, 235, 0)',
            '0 0 0 12px rgba(37, 99, 235, 0.1)',
            '0 0 0 0 rgba(37, 99, 235, 0)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Sparkles className="w-8 h-8 text-electric-500" strokeWidth={1.5} />
      </motion.div>

      {/* Welcome Text */}
      <p className="text-sm font-medium dark:text-white text-black mb-1">
        Vault Secure
      </p>
      <p className="text-xs dark:text-white/40 text-black/40 mb-6">
        Ready to Interrogate
      </p>

      {/* Suggestion Chips */}
      <div className="flex flex-col gap-2 w-full px-2">
        {suggestionChips.map((chip, index) => (
          <motion.button
            key={chip.label}
            onClick={() => onChipClick(chip.prompt)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl',
              'text-xs font-medium',
              'dark:bg-white/5 bg-black/5',
              'dark:text-white/70 text-black/70',
              'border dark:border-white/10 border-black/10',
              'dark:hover:bg-electric-600/20 hover:bg-electric-100',
              'dark:hover:text-electric-400 hover:text-electric-600',
              'dark:hover:border-electric-500/30 hover:border-electric-500/30',
              'transition-all duration-200',
              'text-left'
            )}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            whileHover={{ scale: 1.02, x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="dark:text-electric-400 text-electric-600">
              {chip.icon}
            </span>
            {chip.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

/**
 * Message Bubble - User & Mercury messages
 * User: Right-aligned, bg-neutral-800, pill shape
 * Mercury: Left-aligned, subtle bg-blue-900/10
 */
function MessageBubble({
  message,
  hoveredCitation,
  setHoveredCitation,
}: {
  message: Message
  hoveredCitation: string | null
  setHoveredCitation: (id: string | null) => void
}) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {isUser ? (
        // USER MESSAGE - Right aligned, neutral-800, pill shape
        <div
          className={cn(
            'max-w-[85%] px-4 py-3',
            'rounded-3xl',
            'text-sm text-white',
            'bg-neutral-800'
          )}
        >
          {message.content}
        </div>
      ) : (
        // MERCURY MESSAGE - Left aligned, subtle background
        <div className="max-w-[95%]">
          <div
            className={cn(
              'px-3 py-2 rounded-2xl',
              'text-sm',
              'dark:text-white/90 text-black/90',
              'dark:bg-blue-900/10 bg-blue-100/30'
            )}
          >
            {message.content}
          </div>

          {/* Citation Cards */}
          {message.citations && message.citations.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.citations.map((citation, idx) => {
                const citationId = `${message.id}-${idx}`
                const isHovered = hoveredCitation === citationId

                return (
                  <motion.div
                    key={idx}
                    className={cn(
                      'flex items-start gap-3 px-3 py-2.5 rounded-lg',
                      'text-xs',
                      // Citation card styling
                      'bg-blue-500/5',
                      'border border-blue-500/30',
                      'cursor-pointer',
                      'transition-all duration-200',
                      // Hover state
                      isHovered && 'bg-blue-500/15 border-blue-500/50'
                    )}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1 }}
                    onMouseEnter={() => setHoveredCitation(citationId)}
                    onMouseLeave={() => setHoveredCitation(null)}
                    whileHover={{ scale: 1.01 }}
                  >
                    {/* File Icon */}
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        'bg-blue-500/10',
                        isHovered && 'bg-blue-500/20'
                      )}
                    >
                      <FileText
                        className={cn(
                          'w-4 h-4',
                          'text-blue-400',
                          isHovered && 'text-blue-300'
                        )}
                        strokeWidth={2}
                      />
                    </div>

                    {/* Citation Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-blue-400 truncate">
                          Source: {citation.document}
                        </span>
                        <span className="text-blue-400/60 flex-shrink-0">
                          (Page {citation.page})
                        </span>
                      </div>
                      {/* Snippet preview on hover */}
                      <AnimatePresence>
                        {isHovered && citation.snippet && (
                          <motion.p
                            className="text-[10px] text-blue-300/70 line-clamp-2"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            "{citation.snippet}"
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

/**
 * Thinking Indicator - Cycles through processing phases
 * "Reading Vector DB..." -> "Checking Privilege..." -> "Synthesizing."
 */
function ThinkingIndicator() {
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % thinkingPhases.length)
    }, 1200)

    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      className="flex items-start gap-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Pulsing Mercury avatar */}
      <motion.div
        className={cn(
          'w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0',
          'bg-electric-600/20'
        )}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Sparkles className="w-3 h-3 text-electric-500" strokeWidth={2} />
      </motion.div>

      {/* Thinking text with cycling phases */}
      <div className="flex-1">
        <motion.div
          className={cn(
            'inline-flex items-center gap-2 px-3 py-2 rounded-2xl',
            'dark:bg-blue-900/10 bg-blue-100/30'
          )}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={phaseIndex}
              className="text-sm text-electric-400 font-medium"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              {thinkingPhases[phaseIndex]}
            </motion.span>
          </AnimatePresence>

          {/* Animated dots */}
          <div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-electric-500"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
