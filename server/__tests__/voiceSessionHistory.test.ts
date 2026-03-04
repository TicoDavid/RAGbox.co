/**
 * Voice Session History Tests
 *
 * Tests the conversation history behavior in voice-pipeline-v3.ts:
 * - History starts with only system prompt
 * - User/assistant messages accumulate
 * - System messages stripped from backend payload
 * - History capped at 10 messages (slice(-10))
 * - Backend receives filtered history
 *
 * Replicates the history logic from createVoiceSession() for isolated testing.
 *
 * — Sarah, QA
 */

// ─── Replicate history management from voice-pipeline-v3.ts ──────────────────

interface HistoryEntry {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

const MAX_HISTORY = 10

/**
 * Simulates the voice session history manager.
 * Mirrors voice-pipeline-v3.ts createVoiceSession():
 *   - conversationHistory starts with [{ role: 'system', content: systemPrompt }]
 *   - processWithLLM pushes user + assistant messages
 *   - Backend payload filters to user/assistant only, capped at 10
 */
class VoiceSessionHistory {
  private history: HistoryEntry[]

  constructor(systemPrompt: string) {
    this.history = [{ role: 'system', content: systemPrompt }]
  }

  /** Add a user message (called when STT finalizes) */
  addUserMessage(content: string): void {
    this.history.push({ role: 'user', content })
  }

  /** Add an assistant response (called after LLM responds) */
  addAssistantMessage(content: string): void {
    this.history.push({ role: 'assistant', content })
  }

  /** Add a tool result (prefixed with [Tool Result]) */
  addToolResult(content: string): void {
    this.history.push({ role: 'user', content: `[Tool Result]\n${content}` })
  }

  /** Full history including system prompt */
  getFullHistory(): HistoryEntry[] {
    return [...this.history]
  }

  /**
   * Build the chatHistory sent to Go backend:
   * - Filter to user + assistant only (strip system, tool)
   * - Cap at MAX_HISTORY (10)
   * Mirrors: conversationHistory.filter(h => h.role === 'user' || h.role === 'assistant').slice(-10)
   */
  buildBackendPayload(): HistoryEntry[] {
    return this.history
      .filter((h) => h.role === 'user' || h.role === 'assistant')
      .slice(-MAX_HISTORY)
  }
}

// ─── Test fixtures ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = 'You are Mercury, a professional AI assistant.'

let session: VoiceSessionHistory

beforeEach(() => {
  session = new VoiceSessionHistory(SYSTEM_PROMPT)
})

// ============================================================================
// INITIALIZATION
// ============================================================================

describe('Voice Session History — initialization', () => {
  it('starts with only the system prompt', () => {
    const history = session.getFullHistory()
    expect(history).toHaveLength(1)
    expect(history[0].role).toBe('system')
    expect(history[0].content).toBe(SYSTEM_PROMPT)
  })

  it('backend payload is empty at start (system filtered out)', () => {
    const payload = session.buildBackendPayload()
    expect(payload).toHaveLength(0)
  })
})

// ============================================================================
// MESSAGE ACCUMULATION
// ============================================================================

describe('Voice Session History — message accumulation', () => {
  it('adds user message to history', () => {
    session.addUserMessage('What documents do I have?')
    const history = session.getFullHistory()
    expect(history).toHaveLength(2)
    expect(history[1]).toEqual({ role: 'user', content: 'What documents do I have?' })
  })

  it('adds assistant message to history', () => {
    session.addUserMessage('hello')
    session.addAssistantMessage('Hi there!')
    const history = session.getFullHistory()
    expect(history).toHaveLength(3)
    expect(history[2]).toEqual({ role: 'assistant', content: 'Hi there!' })
  })

  it('maintains message order', () => {
    session.addUserMessage('question 1')
    session.addAssistantMessage('answer 1')
    session.addUserMessage('question 2')
    session.addAssistantMessage('answer 2')

    const payload = session.buildBackendPayload()
    expect(payload.map((h) => h.content)).toEqual([
      'question 1',
      'answer 1',
      'question 2',
      'answer 2',
    ])
  })

  it('tool results are added as user messages', () => {
    session.addToolResult('Found 3 documents in vault')
    const history = session.getFullHistory()
    expect(history[1].role).toBe('user')
    expect(history[1].content).toContain('[Tool Result]')
    expect(history[1].content).toContain('Found 3 documents in vault')
  })
})

// ============================================================================
// SYSTEM MESSAGE STRIPPING
// ============================================================================

describe('Voice Session History — system messages stripped from backend', () => {
  it('system prompt is NOT included in backend payload', () => {
    session.addUserMessage('hello')
    session.addAssistantMessage('hi')
    const payload = session.buildBackendPayload()
    expect(payload.every((h) => h.role !== 'system')).toBe(true)
  })

  it('only user and assistant roles in backend payload', () => {
    session.addUserMessage('q1')
    session.addAssistantMessage('a1')
    session.addToolResult('tool output')
    session.addUserMessage('q2')

    const payload = session.buildBackendPayload()
    const roles = new Set(payload.map((h) => h.role))
    expect(roles.size).toBeLessThanOrEqual(2)
    for (const role of roles) {
      expect(['user', 'assistant']).toContain(role)
    }
  })

  it('tool results pass through filter (stored as user role)', () => {
    session.addToolResult('result data')
    const payload = session.buildBackendPayload()
    expect(payload).toHaveLength(1)
    expect(payload[0].role).toBe('user')
  })
})

// ============================================================================
// HISTORY CAPPING (slice(-10))
// ============================================================================

describe('Voice Session History — capped at 10 messages', () => {
  it('returns at most 10 messages in backend payload', () => {
    for (let i = 0; i < 15; i++) {
      session.addUserMessage(`question ${i}`)
      session.addAssistantMessage(`answer ${i}`)
    }
    const payload = session.buildBackendPayload()
    expect(payload).toHaveLength(MAX_HISTORY)
  })

  it('keeps the most recent 10 messages', () => {
    for (let i = 0; i < 8; i++) {
      session.addUserMessage(`q${i}`)
      session.addAssistantMessage(`a${i}`)
    }
    // 16 user+assistant messages, backend gets last 10
    const payload = session.buildBackendPayload()
    expect(payload).toHaveLength(MAX_HISTORY)
    expect(payload[0].content).toBe('q3')
    expect(payload[payload.length - 1].content).toBe('a7')
  })

  it('full history is NOT capped (only backend payload is)', () => {
    for (let i = 0; i < 15; i++) {
      session.addUserMessage(`q${i}`)
      session.addAssistantMessage(`a${i}`)
    }
    const full = session.getFullHistory()
    // 1 system + 30 user/assistant = 31
    expect(full).toHaveLength(31)
  })

  it('exactly 10 messages returns all 10', () => {
    for (let i = 0; i < 5; i++) {
      session.addUserMessage(`q${i}`)
      session.addAssistantMessage(`a${i}`)
    }
    const payload = session.buildBackendPayload()
    expect(payload).toHaveLength(10)
  })

  it('fewer than 10 messages returns all of them', () => {
    session.addUserMessage('q0')
    session.addAssistantMessage('a0')
    const payload = session.buildBackendPayload()
    expect(payload).toHaveLength(2)
  })
})

// ============================================================================
// BACKEND PAYLOAD SHAPE
// ============================================================================

describe('Voice Session History — backend payload structure', () => {
  it('each entry has role and content', () => {
    session.addUserMessage('test question')
    session.addAssistantMessage('test answer')
    const payload = session.buildBackendPayload()
    for (const entry of payload) {
      expect(entry).toHaveProperty('role')
      expect(entry).toHaveProperty('content')
      expect(typeof entry.role).toBe('string')
      expect(typeof entry.content).toBe('string')
    }
  })

  it('payload is a fresh array (not a reference to internal state)', () => {
    session.addUserMessage('q')
    const p1 = session.buildBackendPayload()
    session.addAssistantMessage('a')
    const p2 = session.buildBackendPayload()
    expect(p1).toHaveLength(1)
    expect(p2).toHaveLength(2)
  })

  it('matches the exact shape sent to Go backend /api/chat', () => {
    session.addUserMessage('What is RAG?')
    session.addAssistantMessage('RAG stands for Retrieval-Augmented Generation.')
    const payload = session.buildBackendPayload()

    // This is what gets sent as backendBody.history
    expect(payload).toEqual([
      { role: 'user', content: 'What is RAG?' },
      { role: 'assistant', content: 'RAG stands for Retrieval-Augmented Generation.' },
    ])
  })
})
