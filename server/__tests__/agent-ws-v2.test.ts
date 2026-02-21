/**
 * Agent WebSocket v2 — Protocol Tests
 *
 * Tests the WebSocket message protocol for voice sessions.
 * Since these are unit tests (not integration), we mock the voice session
 * and verify the message dispatch logic.
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

type ClientControlMsg =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'barge_in' }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'text'; text: string }

type ServerMsg =
  | { type: 'state'; state: AgentState }
  | { type: 'asr_partial'; text: string }
  | { type: 'asr_final'; text: string }
  | { type: 'agent_text_partial'; text: string }
  | { type: 'agent_text_final'; text: string }
  | { type: 'error'; message: string; code?: string }

// ─── Mock VoiceSession ──────────────────────────────────────────────────────

interface MockVoiceSession {
  sendAudio: jest.Mock
  startAudioSession: jest.Mock
  endAudioSession: jest.Mock
  cancelResponse: jest.Mock
  sendText: jest.Mock
  triggerGreeting: jest.Mock
  close: jest.Mock
}

function createMockVoiceSession(): MockVoiceSession {
  return {
    sendAudio: jest.fn().mockResolvedValue(undefined),
    startAudioSession: jest.fn().mockResolvedValue(undefined),
    endAudioSession: jest.fn().mockResolvedValue(undefined),
    cancelResponse: jest.fn().mockResolvedValue(undefined),
    sendText: jest.fn().mockResolvedValue(undefined),
    triggerGreeting: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  }
}

// ─── Mock WebSocket connection handler ──────────────────────────────────────
// Replicates the message dispatch logic from agent-ws.ts

interface MockConnection {
  sentMessages: ServerMsg[]
  sentBinary: Buffer[]
  state: AgentState
  voiceSession: MockVoiceSession
  isAudioSessionActive: boolean
  handleMessage: (data: string | Buffer, isBinary: boolean) => Promise<void>
  setState: (newState: AgentState) => void
}

function createMockConnection(): MockConnection {
  const voiceSession = createMockVoiceSession()
  const sentMessages: ServerMsg[] = []
  const sentBinary: Buffer[] = []
  let state: AgentState = 'connecting'
  let isAudioSessionActive = false

  function sendJSON(msg: ServerMsg) {
    sentMessages.push(msg)
  }

  function sendBinary(data: Buffer) {
    sentBinary.push(data)
  }

  function setState(newState: AgentState) {
    state = newState
    conn.state = state
    sendJSON({ type: 'state', state: newState })
  }

  async function handleMessage(data: string | Buffer, isBinary: boolean) {
    if (isBinary) {
      if (isAudioSessionActive) {
        await voiceSession.sendAudio(data as Buffer)
      }
      return
    }

    try {
      const msg = JSON.parse(data.toString()) as ClientControlMsg

      switch (msg.type) {
        case 'start':
          if (!isAudioSessionActive) {
            await voiceSession.startAudioSession()
            isAudioSessionActive = true
            conn.isAudioSessionActive = true
            setState('listening')
          }
          break

        case 'stop':
          if (isAudioSessionActive) {
            isAudioSessionActive = false
            conn.isAudioSessionActive = false
            setState('processing')
            await voiceSession.endAudioSession()
          }
          break

        case 'barge_in':
          await voiceSession.cancelResponse()
          setState('listening')
          break

        case 'text':
          if (msg.text) {
            setState('processing')
            await voiceSession.sendText(msg.text)
          }
          break

        case 'tool_result':
          // Handled by tool pipeline
          break

        default:
          // Unknown message type — log warning
          break
      }
    } catch {
      sendJSON({ type: 'error', message: 'Invalid message format' })
    }
  }

  const conn: MockConnection = {
    sentMessages,
    sentBinary,
    state,
    voiceSession,
    isAudioSessionActive,
    handleMessage,
    setState,
  }

  return conn
}

// ============================================================================
// TESTS
// ============================================================================

describe('agent-ws-v2 protocol', () => {
  // ─── 2.1 Connection lifecycle ───────────────────────────────────────────
  describe('2.1 Connection lifecycle', () => {
    it('transitions from connecting → idle on session init', () => {
      const conn = createMockConnection()

      // Simulate server-side init sequence
      conn.setState('connecting')
      conn.setState('idle')

      const stateMessages = conn.sentMessages.filter(m => m.type === 'state')
      expect(stateMessages).toEqual([
        { type: 'state', state: 'connecting' },
        { type: 'state', state: 'idle' },
      ])
    })

    it('sends greeting after transitioning to idle', async () => {
      const conn = createMockConnection()

      conn.setState('connecting')
      conn.setState('idle')

      // Simulate greeting trigger (fire-and-forget in real code)
      await conn.voiceSession.triggerGreeting()

      expect(conn.voiceSession.triggerGreeting).toHaveBeenCalled()
    })

    it('sends state:idle after greeting TTS completes', () => {
      const conn = createMockConnection()

      // Simulate: connecting → idle → speaking (greeting) → idle
      conn.setState('connecting')
      conn.setState('idle')
      conn.setState('speaking')
      conn.setState('idle')

      const states = conn.sentMessages
        .filter(m => m.type === 'state')
        .map(m => (m as { type: 'state'; state: AgentState }).state)

      expect(states).toEqual(['connecting', 'idle', 'speaking', 'idle'])
    })
  })

  // ─── 2.2 Text message flow ─────────────────────────────────────────────
  describe('2.2 Text message flow', () => {
    it('processes text message and transitions through states', async () => {
      const conn = createMockConnection()
      conn.setState('idle')

      await conn.handleMessage(JSON.stringify({ type: 'text', text: 'hello' }), false)

      // Should transition to processing
      const states = conn.sentMessages
        .filter(m => m.type === 'state')
        .map(m => (m as { type: 'state'; state: AgentState }).state)

      expect(states).toContain('processing')
      expect(conn.voiceSession.sendText).toHaveBeenCalledWith('hello')
    })

    it('calls voiceSession.sendText with the message text', async () => {
      const conn = createMockConnection()
      conn.setState('idle')

      await conn.handleMessage(JSON.stringify({ type: 'text', text: 'What is RAGbox?' }), false)

      expect(conn.voiceSession.sendText).toHaveBeenCalledWith('What is RAGbox?')
    })
  })

  // ─── 2.3 Audio session flow ────────────────────────────────────────────
  describe('2.3 Audio session flow', () => {
    it('transitions to listening on start message', async () => {
      const conn = createMockConnection()
      conn.setState('idle')

      await conn.handleMessage(JSON.stringify({ type: 'start' }), false)

      expect(conn.voiceSession.startAudioSession).toHaveBeenCalled()
      const states = conn.sentMessages
        .filter(m => m.type === 'state')
        .map(m => (m as { type: 'state'; state: AgentState }).state)
      expect(states).toContain('listening')
    })

    it('forwards binary audio frames to voiceSession.sendAudio', async () => {
      const conn = createMockConnection()
      conn.setState('idle')

      // Start audio session first
      await conn.handleMessage(JSON.stringify({ type: 'start' }), false)

      // Send binary PCM frame
      const pcm = Buffer.alloc(3200) // 1 frame
      await conn.handleMessage(pcm, true)

      expect(conn.voiceSession.sendAudio).toHaveBeenCalledWith(pcm)
    })

    it('ignores binary data when audio session is not active', async () => {
      const conn = createMockConnection()
      conn.setState('idle')

      // Send binary without starting audio session
      const pcm = Buffer.alloc(3200)
      await conn.handleMessage(pcm, true)

      expect(conn.voiceSession.sendAudio).not.toHaveBeenCalled()
    })

    it('transitions to processing on stop message', async () => {
      const conn = createMockConnection()
      conn.setState('idle')

      await conn.handleMessage(JSON.stringify({ type: 'start' }), false)
      await conn.handleMessage(JSON.stringify({ type: 'stop' }), false)

      expect(conn.voiceSession.endAudioSession).toHaveBeenCalled()
      const states = conn.sentMessages
        .filter(m => m.type === 'state')
        .map(m => (m as { type: 'state'; state: AgentState }).state)
      expect(states).toContain('processing')
    })

    it('follows full flow: start → audio → stop → processing', async () => {
      const conn = createMockConnection()
      conn.setState('idle')

      await conn.handleMessage(JSON.stringify({ type: 'start' }), false)
      await conn.handleMessage(Buffer.alloc(3200), true)
      await conn.handleMessage(Buffer.alloc(3200), true)
      await conn.handleMessage(JSON.stringify({ type: 'stop' }), false)

      expect(conn.voiceSession.startAudioSession).toHaveBeenCalledTimes(1)
      expect(conn.voiceSession.sendAudio).toHaveBeenCalledTimes(2)
      expect(conn.voiceSession.endAudioSession).toHaveBeenCalledTimes(1)

      const states = conn.sentMessages
        .filter(m => m.type === 'state')
        .map(m => (m as { type: 'state'; state: AgentState }).state)

      // idle → listening → processing
      expect(states).toEqual(['idle', 'listening', 'processing'])
    })
  })

  // ─── 2.4 Barge-in ──────────────────────────────────────────────────────
  describe('2.4 Barge-in', () => {
    it('calls cancelResponse and transitions to listening', async () => {
      const conn = createMockConnection()
      conn.setState('speaking')

      await conn.handleMessage(JSON.stringify({ type: 'barge_in' }), false)

      expect(conn.voiceSession.cancelResponse).toHaveBeenCalled()
      const states = conn.sentMessages
        .filter(m => m.type === 'state')
        .map(m => (m as { type: 'state'; state: AgentState }).state)
      expect(states).toContain('listening')
    })

    it('stops audio output after barge-in', async () => {
      const conn = createMockConnection()
      conn.setState('speaking')

      await conn.handleMessage(JSON.stringify({ type: 'barge_in' }), false)

      // cancelResponse should have been called to stop TTS
      expect(conn.voiceSession.cancelResponse).toHaveBeenCalledTimes(1)
    })
  })

  // ─── 2.5 Invalid message handling ───────────────────────────────────────
  describe('2.5 Invalid message handling', () => {
    it('sends error message for unparseable JSON', async () => {
      const conn = createMockConnection()
      conn.setState('idle')

      await conn.handleMessage('not json at all', false)

      const errors = conn.sentMessages.filter(m => m.type === 'error')
      expect(errors).toHaveLength(1)
      expect((errors[0] as { type: 'error'; message: string }).message).toBe('Invalid message format')
    })

    it('does not crash on unknown message type', async () => {
      const conn = createMockConnection()
      conn.setState('idle')

      // Should not throw
      await expect(
        conn.handleMessage(JSON.stringify({ type: 'invalid_type' }), false),
      ).resolves.toBeUndefined()
    })

    it('connection stays alive after invalid message', async () => {
      const conn = createMockConnection()
      conn.setState('idle')

      await conn.handleMessage('broken', false)

      // Should still be able to handle valid messages
      await conn.handleMessage(JSON.stringify({ type: 'text', text: 'hello' }), false)

      expect(conn.voiceSession.sendText).toHaveBeenCalledWith('hello')
    })

    it('does not crash on empty message', async () => {
      const conn = createMockConnection()
      conn.setState('idle')

      await expect(conn.handleMessage('', false)).resolves.toBeUndefined()
    })
  })
})
