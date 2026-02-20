/**
 * Store-level tests for chatStore.
 *
 * Verifies clearThread resets all state fields correctly,
 * including documentScope and documentScopeName (GAP-2).
 */
import { useChatStore } from './chatStore'
import type { ChatMessage } from '@/types/ragbox'

// ── Helpers ──────────────────────────────────────────────────

/** Dirty up the store so clearThread has something to reset. */
function seedStore() {
  const msg: ChatMessage = {
    id: 'test-msg-1',
    role: 'user',
    content: 'What is this document about?',
    timestamp: new Date(),
  }

  useChatStore.setState({
    threadId: 'thread-abc-123',
    threadTitle: 'Contract Analysis',
    messages: [msg],
    inputValue: 'follow-up question',
    isStreaming: true,
    streamingContent: 'partial response...',
    abortController: new AbortController(),
    documentScope: 'doc-xyz-456',
    documentScopeName: 'NDA_Final.pdf',
    safetyMode: false,
    selectedModel: 'gpt-4o',
  })
}

// ── Tests ────────────────────────────────────────────────────

beforeEach(() => {
  // Reset to initial state before each test
  useChatStore.setState({
    threadId: null,
    threadTitle: 'New Chat',
    messages: [],
    inputValue: '',
    isStreaming: false,
    streamingContent: '',
    abortController: null,
    safetyMode: true,
    selectedModel: 'aegis',
    documentScope: null,
    documentScopeName: null,
  })
})

describe('chatStore.clearThread', () => {
  it('resets thread fields to initial state', () => {
    seedStore()

    // Verify dirty state
    expect(useChatStore.getState().threadId).toBe('thread-abc-123')
    expect(useChatStore.getState().messages).toHaveLength(1)
    expect(useChatStore.getState().threadTitle).toBe('Contract Analysis')

    useChatStore.getState().clearThread()

    const s = useChatStore.getState()
    expect(s.threadId).toBeNull()
    expect(s.threadTitle).toBe('New Chat')
    expect(s.messages).toEqual([])
  })

  it('clears documentScope and documentScopeName', () => {
    seedStore()

    expect(useChatStore.getState().documentScope).toBe('doc-xyz-456')
    expect(useChatStore.getState().documentScopeName).toBe('NDA_Final.pdf')

    useChatStore.getState().clearThread()

    const s = useChatStore.getState()
    expect(s.documentScope).toBeNull()
    expect(s.documentScopeName).toBeNull()
  })

  it('resets transient streaming state', () => {
    seedStore()

    expect(useChatStore.getState().isStreaming).toBe(true)
    expect(useChatStore.getState().streamingContent).toBe('partial response...')
    expect(useChatStore.getState().abortController).not.toBeNull()

    useChatStore.getState().clearThread()

    const s = useChatStore.getState()
    expect(s.isStreaming).toBe(false)
    expect(s.streamingContent).toBe('')
    expect(s.abortController).toBeNull()
    expect(s.inputValue).toBe('')
  })

  it('does not reset safetyMode or selectedModel', () => {
    seedStore()

    // safetyMode was set to false, selectedModel to gpt-4o
    expect(useChatStore.getState().safetyMode).toBe(false)
    expect(useChatStore.getState().selectedModel).toBe('gpt-4o')

    useChatStore.getState().clearThread()

    const s = useChatStore.getState()
    // clearThread should NOT touch user preferences
    expect(s.safetyMode).toBe(false)
    expect(s.selectedModel).toBe('gpt-4o')
  })
})

describe('chatStore.setDocumentScope', () => {
  it('sets documentScope and clears documentScopeName', () => {
    useChatStore.getState().setDocumentScope('doc-new-789')

    const s = useChatStore.getState()
    expect(s.documentScope).toBe('doc-new-789')
    expect(s.documentScopeName).toBeNull()
  })

  it('clears documentScope when passed null', () => {
    seedStore()

    useChatStore.getState().setDocumentScope(null)

    const s = useChatStore.getState()
    expect(s.documentScope).toBeNull()
    expect(s.documentScopeName).toBeNull()
  })
})
