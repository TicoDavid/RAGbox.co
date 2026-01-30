'use client'

import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, UseChatOptions, UseChatReturn } from '@/types/ui'
import type { ChatStreamEvent, ChatCitationDTO } from '@/types/api'

/**
 * Extracted SSE streaming chat hook.
 * Supports both streaming (SSE via ReadableStream) and non-streaming modes.
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const {
    endpoint = '/api/chat',
    stream = true,
    privilegeMode = false,
    maxTier,
    systemPrompt,
    onMessageComplete,
    onError,
  } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    setError(null)

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: text.trim(),
      isUser: true,
      timestamp: Date.now(),
    }

    const assistantId = `assistant-${Date.now()}`
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      text: '',
      isUser: false,
      timestamp: Date.now(),
      isStreaming: true,
    }

    setMessages(prev => [...prev, userMessage, assistantPlaceholder])
    setIsLoading(true)

    // Build history from existing messages for context
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.text }))

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          privilegeMode,
          maxTier,
          systemPrompt,
          stream,
          history,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error('Query failed')
      }

      let fullContent = ''
      let confidence: number | undefined
      let citations: ChatCitationDTO[] | undefined

      if (stream && response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

            for (const line of lines) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data) as ChatStreamEvent
                if (parsed.type === 'content') {
                  fullContent += parsed.content
                  setMessages(prev => prev.map(msg =>
                    msg.id === assistantId
                      ? { ...msg, text: fullContent }
                      : msg
                  ))
                } else if (parsed.type === 'confidence') {
                  confidence = parsed.confidence
                } else if (parsed.type === 'citations') {
                  citations = parsed.citations
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        } finally {
          reader.releaseLock()
        }
      } else {
        const json = await response.json()
        fullContent = json.answer ?? json.content ?? ''
        confidence = json.confidence
        citations = json.citations
      }

      const finalMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        text: fullContent || 'No response generated.',
        isUser: false,
        timestamp: Date.now(),
        isStreaming: false,
        confidence,
        citations,
      }

      setMessages(prev => prev.map(msg =>
        msg.id === assistantId ? finalMessage : msg
      ))

      onMessageComplete?.(finalMessage)

    } catch (err) {
      if ((err as Error).name === 'AbortError') return

      const errorMsg = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMsg)
      onError?.(err instanceof Error ? err : new Error(errorMsg))

      setMessages(prev => prev.map(msg =>
        msg.id === assistantId
          ? {
              ...msg,
              text: '> ERROR: INTERROGATION VECTOR FAILED\n> RETRY OR CONTACT SYSTEMS ADMIN',
              isStreaming: false,
            }
          : msg
      ))
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [isLoading, messages, endpoint, stream, privilegeMode, maxTier, systemPrompt, onMessageComplete, onError])

  const clearMessages = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    setMessages,
  }
}
