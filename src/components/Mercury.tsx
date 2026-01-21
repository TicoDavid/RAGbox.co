'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

/**
 * Mercury Component - AI Concierge (Right Sidebar)
 *
 * Features:
 * - Glassmorphism design
 * - Pulsing green "Online" indicator
 * - Floating pill-shaped input
 * - Logo watermark in empty state
 */
export function Mercury() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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

    // Simulate AI response (to be replaced with actual API call)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          'I can help you interrogate your documents. Upload files to The Box and ask me questions about their contents.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <motion.aside
      className={cn(
        'h-screen w-80 flex flex-col',
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
          className="flex items-center gap-3"
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
          <div className="flex-1">
            <h2 className="font-bold dark:text-white text-black">Mercury</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-trust-high animate-pulse" />
              <span className="text-xs dark:text-white/40 text-black/40">
                AI Concierge Online
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && <TypingIndicator />}
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

function EmptyState() {
  return (
    <motion.div
      className="h-full flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
    >
      {/* Watermark Logo */}
      <img
        src="https://storage.googleapis.com/connexusai-assets/WhiteLogo_RAGbox.co-removebg-preview.png"
        alt="RAGbox"
        className="h-16 w-auto opacity-10 mb-6"
      />
      <p className="text-sm dark:text-white/30 text-black/30 text-center px-4">
        Upload documents to The Box, then ask Mercury to interrogate them.
      </p>
    </motion.div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div
        className={cn(
          'max-w-[85%] px-4 py-3 rounded-2xl',
          'text-sm',
          isUser
            ? cn('bg-electric-600 text-white', 'rounded-br-md')
            : cn(
                'dark:bg-white/10 bg-black/5',
                'dark:text-white text-black',
                'rounded-bl-md'
              )
        )}
      >
        {message.content}
      </div>
    </motion.div>
  )
}

function TypingIndicator() {
  return (
    <motion.div
      className="flex justify-start"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div
        className={cn(
          'px-4 py-3 rounded-2xl rounded-bl-md',
          'dark:bg-white/10 bg-black/5'
        )}
      >
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full dark:bg-white/40 bg-black/40"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
