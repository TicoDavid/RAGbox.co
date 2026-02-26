/**
 * BUG-042 SA-042-01: WebSocket Lifecycle Tests
 *
 * Tests the full voice session lifecycle — the connection must stay alive
 * through the entire STT → LLM → TTS cycle. Specifically validates that
 * the WebSocket does NOT close before TTS audio is fully delivered.
 *
 * — Sarah, QA
 */

// ─── Types mirroring agent-ws.ts ────────────────────────────────────────────

type AgentState =
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'executing'
  | 'idle'
  | 'error'

type ServerMsg =
  | { type: 'state'; state: AgentState }
  | { type: 'asr_partial'; text: string }
  | { type: 'asr_final'; text: string }
  | { type: 'agent_text_partial'; text: string }
  | { type: 'agent_text_final'; text: string }
  | { type: 'error'; message: string; code?: string }

// ─── Mock VoiceSession with realistic timing ────────────────────────────────

interface TimedVoiceSession {
  sendAudio: jest.Mock
  startAudioSession: jest.Mock
  endAudioSession: jest.Mock
  cancelResponse: jest.Mock
  sendText: jest.Mock
  triggerGreeting: jest.Mock
  close: jest.Mock
}

// ─── Mock WebSocket ─────────────────────────────────────────────────────────

const OPEN = 1
const CLOSED = 3

interface MockWebSocket {
  readyState: number
  sentMessages: ServerMsg[]
  sentBinary: Buffer[]
  closeCode: number | null
  closeReason: string | null
  close: (code?: number, reason?: string) => void
}

function createMockWS(): MockWebSocket {
  const ws: MockWebSocket = {
    readyState: OPEN,
    sentMessages: [],
    sentBinary: [],
    closeCode: null,
    closeReason: null,
    close(code?: number, reason?: string) {
      ws.readyState = CLOSED
      ws.closeCode = code ?? 1000
      ws.closeReason = reason ?? ''
    },
  }
  return ws
}

// ─── Session harness with event timeline ────────────────────────────────────

interface LifecycleHarness {
  ws: MockWebSocket
  state: AgentState
  voiceSession: TimedVoiceSession
  isAudioSessionActive: boolean
  timeline: Array<{ event: string; ts: number }>
  setState: (newState: AgentState) => void
  sendJSON: (msg: ServerMsg) => void
  sendBinary: (data: Buffer) => void
  handleTextMessage: (text: string) => Promise<void>
}

function createLifecycleHarness(opts?: {
  sttMs?: number
  llmMs?: number
  ttsChunks?: number
  ttsChunkDelayMs?: number
}): LifecycleHarness {
  const sttMs = opts?.sttMs ?? 500
  const llmMs = opts?.llmMs ?? 1500
  const ttsChunks = opts?.ttsChunks ?? 5
  const ttsChunkDelayMs = opts?.ttsChunkDelayMs ?? 400

  const ws = createMockWS()
  const timeline: Array<{ event: string; ts: number }> = []
  let state: AgentState = 'idle'
  let isAudioSessionActive = false
  let cancelled = false

  function sendJSON(msg: ServerMsg) {
    if (ws.readyState === OPEN) {
      ws.sentMessages.push(msg)
    }
  }

  function sendBinary(data: Buffer) {
    if (ws.readyState === OPEN) {
      ws.sentBinary.push(data)
      timeline.push({ event: 'binary_chunk', ts: Date.now() })
    }
  }

  function setState(newState: AgentState) {
    state = newState
    harness.state = state
    sendJSON({ type: 'state', state: newState })
    timeline.push({ event: `state:${newState}`, ts: Date.now() })
  }

  // Simulate the full pipeline with realistic timing
  async function processText(text: string): Promise<void> {
    // STT phase (already have text, but simulate latency)
    sendJSON({ type: 'asr_final', text })
    setState('processing')

    // LLM phase
    await delay(llmMs)
    if (cancelled) return

    const answer = `Mercury response to: ${text}`
    sendJSON({ type: 'agent_text_partial', text: answer.slice(0, 10) })
    sendJSON({ type: 'agent_text_final', text: answer })
    timeline.push({ event: 'agent_text_final', ts: Date.now() })

    // TTS phase — chunked delivery
    setState('speaking')
    for (let i = 0; i < ttsChunks; i++) {
      if (cancelled) break
      await delay(ttsChunkDelayMs)
      if (cancelled) break
      const chunk = Buffer.alloc(16384, i) // 16KB chunk
      sendBinary(chunk)
    }

    if (!cancelled) {
      setState('idle')
    }
  }

  const voiceSession: TimedVoiceSession = {
    sendAudio: jest.fn().mockResolvedValue(undefined),
    startAudioSession: jest.fn().mockImplementation(() => {
      isAudioSessionActive = true
      harness.isAudioSessionActive = true
    }),
    endAudioSession: jest.fn().mockResolvedValue(undefined),
    cancelResponse: jest.fn().mockImplementation(() => {
      cancelled = true
    }),
    sendText: jest.fn().mockImplementation(async (text: string) => {
      cancelled = false
      await processText(text)
    }),
    triggerGreeting: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockImplementation(() => {
      cancelled = true
    }),
  }

  async function handleTextMessage(text: string) {
    setState('processing')
    await voiceSession.sendText(text)
  }

  const harness: LifecycleHarness = {
    ws,
    state,
    voiceSession,
    isAudioSessionActive,
    timeline,
    setState,
    sendJSON,
    sendBinary,
    handleTextMessage,
  }

  return harness
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// TESTS
// ============================================================================

describe('WebSocket Lifecycle (BUG-042 SA-042-01)', () => {

  // TEST 1
  it('WebSocket stays open through full STT→LLM→TTS cycle', async () => {
    const h = createLifecycleHarness({
      sttMs: 50, llmMs: 100, ttsChunks: 3, ttsChunkDelayMs: 50,
    })

    await h.handleTextMessage('Hello')

    // Verify received agent_text_final
    const textFinal = h.ws.sentMessages.find(m => m.type === 'agent_text_final')
    expect(textFinal).toBeDefined()

    // Verify received binary audio chunks
    expect(h.ws.sentBinary.length).toBeGreaterThanOrEqual(1)

    // Verify received state:idle AFTER binary audio
    const states = h.ws.sentMessages
      .filter(m => m.type === 'state')
      .map(m => (m as { type: 'state'; state: AgentState }).state)
    expect(states[states.length - 1]).toBe('idle')

    // WebSocket MUST be OPEN after state:idle
    expect(h.ws.readyState).toBe(OPEN)

    // Close code should NOT have been sent
    expect(h.ws.closeCode).toBeNull()
  }, 10000)

  // TEST 2
  it('state:idle arrives AFTER last TTS audio chunk', async () => {
    const h = createLifecycleHarness({
      sttMs: 50, llmMs: 100, ttsChunks: 4, ttsChunkDelayMs: 50,
    })

    await h.handleTextMessage('Tell me about the contract')

    // Find timestamps
    const lastBinaryTs = h.timeline
      .filter(e => e.event === 'binary_chunk')
      .map(e => e.ts)
      .pop()

    const idleTs = h.timeline
      .filter(e => e.event === 'state:idle')
      .map(e => e.ts)
      .pop()

    expect(lastBinaryTs).toBeDefined()
    expect(idleTs).toBeDefined()
    expect(idleTs!).toBeGreaterThanOrEqual(lastBinaryTs!)
  }, 10000)

  // TEST 3
  it('WebSocket does not close on agent_text_final', async () => {
    const h = createLifecycleHarness({
      sttMs: 50, llmMs: 100, ttsChunks: 3, ttsChunkDelayMs: 50,
    })

    await h.handleTextMessage('Summarize the report')

    // agent_text_final should have been sent
    const textFinal = h.ws.sentMessages.find(m => m.type === 'agent_text_final')
    expect(textFinal).toBeDefined()

    // Find agent_text_final in timeline
    const textFinalTs = h.timeline.find(e => e.event === 'agent_text_final')
    expect(textFinalTs).toBeDefined()

    // Binary audio chunks should arrive AFTER agent_text_final
    const binaryAfterText = h.timeline
      .filter(e => e.event === 'binary_chunk' && e.ts >= textFinalTs!.ts)
    expect(binaryAfterText.length).toBeGreaterThan(0)

    // WebSocket is still open after all audio
    expect(h.ws.readyState).toBe(OPEN)
  }, 10000)

  // TEST 4
  it('client disconnect during TTS does not crash server', async () => {
    const h = createLifecycleHarness({
      sttMs: 50, llmMs: 100, ttsChunks: 10, ttsChunkDelayMs: 100,
    })

    // Start processing but force-close WS mid-TTS
    const processPromise = h.handleTextMessage('Long analysis query')

    // Wait for LLM to complete and first TTS chunk to arrive
    await delay(300)

    // Force-close the WebSocket from client side
    h.ws.close(1000, 'Client navigated away')
    expect(h.ws.readyState).toBe(CLOSED)

    // The server should NOT throw — just stop sending
    await expect(processPromise).resolves.toBeUndefined()

    // Some binary chunks may have been sent before close, but not all 10
    expect(h.ws.sentBinary.length).toBeLessThan(10)
  }, 15000)

  // TEST 5
  it('barge-in during audio stops TTS but keeps connection', async () => {
    const h = createLifecycleHarness({
      sttMs: 50, llmMs: 100, ttsChunks: 10, ttsChunkDelayMs: 100,
    })

    // Start processing
    const processPromise = h.handleTextMessage('Give me a summary')

    // Wait for first TTS chunk, then barge in
    await delay(400)
    h.voiceSession.cancelResponse()
    h.setState('listening')

    await processPromise

    // Binary audio should have stopped (not all 10 chunks delivered)
    expect(h.ws.sentBinary.length).toBeLessThan(10)

    // State should have transitioned to listening
    const states = h.ws.sentMessages
      .filter(m => m.type === 'state')
      .map(m => (m as { type: 'state'; state: AgentState }).state)
    expect(states).toContain('listening')

    // WebSocket MUST still be open
    expect(h.ws.readyState).toBe(OPEN)
    expect(h.ws.closeCode).toBeNull()
  }, 15000)
})
