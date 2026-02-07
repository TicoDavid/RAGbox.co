/**
 * Agent WebSocket Server - RAGbox.co
 *
 * Full-duplex WebSocket spine for voice AI:
 * Browser ⇄ This Server ⇄ Inworld
 *
 * Protocol:
 * Client → Server:
 *   - audio_chunk: binary PCM frames (16kHz, mono, s16le)
 *   - control: { type: "start" | "stop" | "barge_in" }
 *   - tool_result: { type: "tool_result", name: string, result: any }
 *
 * Server → Client:
 *   - asr_partial / asr_final: speech-to-text results
 *   - agent_text_partial / agent_text_final: Mercury's response text
 *   - tts_audio_chunk: binary audio for playback
 *   - tool_call: structured tool invocation request
 *   - state: connection state updates
 */

import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage, Server as HttpServer } from 'http'
import { URL } from 'url'
import { executeTool, type ToolCall, type ToolResult, type ToolContext, TOOL_DEFINITIONS } from './tools'
import { checkToolPermission, createConfirmationRequest, storePendingConfirmation } from './tools/permissions'
import * as obs from './observability'

// ============================================================================
// TYPES
// ============================================================================

type ClientControlMsg =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'barge_in' }
  | { type: 'tool_result'; name: string; result: unknown }

type ServerMsg =
  | { type: 'state'; state: AgentState }
  | { type: 'asr_partial'; text: string }
  | { type: 'asr_final'; text: string }
  | { type: 'agent_text_partial'; text: string }
  | { type: 'agent_text_final'; text: string }
  | { type: 'tool_call'; call: ToolCallRequest }
  | { type: 'tool_call_requires_confirmation'; request: { toolCallId: string; toolName: string; message: string; severity: string } }
  | { type: 'tool_result'; result: ToolResult }
  | { type: 'ui_action'; action: unknown }
  | { type: 'error'; message: string; code?: string }

type AgentState =
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'idle'
  | 'error'

interface ToolCallRequest {
  id: string
  name: string
  parameters: Record<string, unknown>
}

interface AgentSession {
  ws: WebSocket
  sessionId: string
  state: AgentState
  createdAt: number
  lastActivity: number
  // Tool execution context
  toolContext: ToolContext
  // TODO: Inworld session reference
  // inworldSession?: InworldSession
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

const sessions = new Map<string, AgentSession>()
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now()
  for (const [sessionId, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      console.log(`[AgentWS] Cleaning up expired session: ${sessionId}`)
      session.ws.close(1000, 'Session expired')
      sessions.delete(sessionId)
    }
  }
}, 60_000) // Check every minute

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sendJSON(ws: WebSocket, msg: ServerMsg): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

function sendBinary(ws: WebSocket, data: Buffer): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(data, { binary: true })
  }
}

function generateSessionId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

interface ConnectionParams {
  sessionId: string | null
  userId: string
  role: 'User' | 'Admin' | 'Viewer'
  privilegeMode: boolean
}

function extractConnectionParams(req: IncomingMessage): ConnectionParams {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    return {
      sessionId: url.searchParams.get('sessionId'),
      userId: url.searchParams.get('userId') || 'anonymous',
      role: (url.searchParams.get('role') as ConnectionParams['role']) || 'User',
      privilegeMode: url.searchParams.get('privilegeMode') === 'true',
    }
  } catch {
    return { sessionId: null, userId: 'anonymous', role: 'User', privilegeMode: false }
  }
}

// ============================================================================
// INWORLD INTEGRATION (TODO: Replace with actual SDK)
// ============================================================================

/**
 * Creates an Inworld session for voice AI
 * TODO: Implement with actual Inworld SDK
 */
async function createInworldSession(_config: {
  apiKey: string
  sceneId?: string
  characterId?: string
}): Promise<{
  onTranscriptPartial: (cb: (text: string) => void) => void
  onTranscriptFinal: (cb: (text: string) => void) => void
  onAgentTextPartial: (cb: (text: string) => void) => void
  onAgentTextFinal: (cb: (text: string) => void) => void
  onTTSChunk: (cb: (audio: Buffer) => void) => void
  onToolCall: (cb: (call: ToolCallRequest) => void) => void
  sendAudio: (audio: Buffer) => Promise<void>
  sendToolResult: (name: string, result: unknown) => Promise<void>
  startTurn: () => void
  endTurn: () => void
  bargeIn: () => void
  close: () => Promise<void>
}> {
  // Placeholder implementation
  // Replace with actual Inworld SDK initialization

  const callbacks = {
    transcriptPartial: [] as ((text: string) => void)[],
    transcriptFinal: [] as ((text: string) => void)[],
    agentTextPartial: [] as ((text: string) => void)[],
    agentTextFinal: [] as ((text: string) => void)[],
    ttsChunk: [] as ((audio: Buffer) => void)[],
    toolCall: [] as ((call: ToolCallRequest) => void)[],
  }

  return {
    onTranscriptPartial: (cb) => callbacks.transcriptPartial.push(cb),
    onTranscriptFinal: (cb) => callbacks.transcriptFinal.push(cb),
    onAgentTextPartial: (cb) => callbacks.agentTextPartial.push(cb),
    onAgentTextFinal: (cb) => callbacks.agentTextFinal.push(cb),
    onTTSChunk: (cb) => callbacks.ttsChunk.push(cb),
    onToolCall: (cb) => callbacks.toolCall.push(cb),

    sendAudio: async (_audio: Buffer) => {
      // TODO: Send audio to Inworld
      console.log('[Inworld] Audio chunk received')
    },

    sendToolResult: async (_name: string, _result: unknown) => {
      // TODO: Send tool result to Inworld
      console.log('[Inworld] Tool result sent')
    },

    startTurn: () => {
      console.log('[Inworld] Turn started')
    },

    endTurn: () => {
      console.log('[Inworld] Turn ended')
    },

    bargeIn: () => {
      console.log('[Inworld] Barge-in triggered')
    },

    close: async () => {
      console.log('[Inworld] Session closed')
    },
  }
}

// ============================================================================
// WEBSOCKET CONNECTION HANDLER
// ============================================================================

async function handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
  const params = extractConnectionParams(req)
  const sessionId = params.sessionId || generateSessionId()

  console.log(`[AgentWS] New connection: ${sessionId} (user: ${params.userId}, role: ${params.role})`)

  // Initialize observability
  obs.initSession(sessionId, params.userId)

  // Create tool context for this session
  const toolContext: ToolContext = {
    userId: params.userId,
    role: params.role,
    sessionId,
    privilegeMode: params.privilegeMode,
  }

  // Create session
  const session: AgentSession = {
    ws,
    sessionId,
    state: 'connecting',
    createdAt: Date.now(),
    lastActivity: Date.now(),
    toolContext,
  }
  sessions.set(sessionId, session)

  // Send connecting state
  sendJSON(ws, { type: 'state', state: 'connecting' })

  try {
    // Initialize Inworld session
    const inworld = await createInworldSession({
      apiKey: process.env.INWORLD_API_KEY || '',
      sceneId: process.env.INWORLD_SCENE_ID,
      characterId: process.env.INWORLD_CHARACTER_ID,
    })

    // Wire Inworld events to WebSocket
    inworld.onTranscriptPartial((text) => {
      sendJSON(ws, { type: 'asr_partial', text })
    })

    inworld.onTranscriptFinal((text) => {
      sendJSON(ws, { type: 'asr_final', text })
      obs.logTranscript(sessionId, 'user', text, true)
      obs.incrementTurn(sessionId)
    })

    inworld.onAgentTextPartial((text) => {
      sendJSON(ws, { type: 'agent_text_partial', text })
      session.state = 'speaking'
      sendJSON(ws, { type: 'state', state: 'speaking' })
    })

    inworld.onAgentTextFinal((text) => {
      sendJSON(ws, { type: 'agent_text_final', text })
      obs.logTranscript(sessionId, 'agent', text, true)
      session.state = 'idle'
      sendJSON(ws, { type: 'state', state: 'idle' })
    })

    inworld.onTTSChunk((audio) => {
      sendBinary(ws, audio)
    })

    inworld.onToolCall(async (call) => {
      // Check permissions first
      const permission = checkToolPermission(call.name, session.toolContext)

      if (!permission.allowed) {
        sendJSON(ws, {
          type: 'error',
          message: permission.reason || `Not authorized for ${call.name}`,
          code: 'PERMISSION_DENIED',
        })
        return
      }

      // Check if confirmation is required
      if (permission.requiresConfirmation) {
        const confirmRequest = createConfirmationRequest(call.id, call.name)
        if (confirmRequest) {
          storePendingConfirmation(confirmRequest)
          sendJSON(ws, {
            type: 'tool_call_requires_confirmation',
            request: {
              toolCallId: call.id,
              toolName: call.name,
              message: confirmRequest.message,
              severity: confirmRequest.severity,
            },
          })
          return // Wait for confirmation
        }
      }

      // Notify client that tool is being called
      sendJSON(ws, { type: 'tool_call', call })

      // Log tool call start
      obs.logToolCallStart(sessionId, call.id, call.name, call.parameters)

      // Execute the tool on the server
      const toolCall: ToolCall = {
        id: call.id,
        name: call.name,
        arguments: call.parameters,
      }

      const result = await executeTool(toolCall, session.toolContext)

      // Log tool call end
      obs.logToolCallEnd(call.id, result.success, result.error)

      // Send result back to Inworld so it can continue conversation
      // inworld.sendToolResult(call.name, result.result)

      // Send result to client for UI sync
      sendJSON(ws, { type: 'tool_result', result })

      // If there's a UI action, send it separately for immediate execution
      if (result.uiAction) {
        sendJSON(ws, { type: 'ui_action', action: result.uiAction })
      }
    })

    // Ready to receive audio
    session.state = 'listening'
    sendJSON(ws, { type: 'state', state: 'listening' })

    // Handle incoming messages
    ws.on('message', async (data, isBinary) => {
      session.lastActivity = Date.now()

      if (isBinary) {
        // Binary = audio chunk from client microphone
        try {
          await inworld.sendAudio(data as Buffer)
        } catch (error) {
          console.error('[AgentWS] Error sending audio:', error)
        }
        return
      }

      // Text = control message
      try {
        const msg = JSON.parse(data.toString()) as ClientControlMsg

        switch (msg.type) {
          case 'start':
            inworld.startTurn()
            session.state = 'listening'
            sendJSON(ws, { type: 'state', state: 'listening' })
            break

          case 'stop':
            inworld.endTurn()
            session.state = 'processing'
            sendJSON(ws, { type: 'state', state: 'processing' })
            break

          case 'barge_in':
            inworld.bargeIn()
            obs.incrementBargeIn(sessionId)
            obs.logAudioEvent(sessionId, 'barge_in')
            session.state = 'listening'
            sendJSON(ws, { type: 'state', state: 'listening' })
            break

          case 'tool_result':
            await inworld.sendToolResult(msg.name, msg.result)
            break

          default:
            console.warn('[AgentWS] Unknown message type:', msg)
        }
      } catch (error) {
        console.error('[AgentWS] Error parsing message:', error)
        sendJSON(ws, { type: 'error', message: 'Invalid message format' })
      }
    })

    // Handle disconnection
    ws.on('close', async (code, reason) => {
      console.log(`[AgentWS] Connection closed: ${sessionId} (${code}: ${reason.toString()})`)
      obs.endSession(sessionId)
      await inworld.close()
      sessions.delete(sessionId)
    })

    ws.on('error', (error) => {
      console.error(`[AgentWS] WebSocket error for ${sessionId}:`, error)
      session.state = 'error'
      sendJSON(ws, { type: 'state', state: 'error' })
      sendJSON(ws, { type: 'error', message: error.message })
    })

  } catch (error) {
    console.error('[AgentWS] Failed to initialize session:', error)
    session.state = 'error'
    sendJSON(ws, { type: 'state', state: 'error' })
    sendJSON(ws, {
      type: 'error',
      message: error instanceof Error ? error.message : 'Failed to initialize session',
    })
    ws.close(1011, 'Initialization failed')
    sessions.delete(sessionId)
  }
}

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

/**
 * Start the Agent WebSocket server
 * Attach to an existing HTTP server (Express/Fastify/Next custom server)
 */
export function startAgentWSServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/agent/ws',
  })

  console.log('[AgentWS] WebSocket server started on /agent/ws')

  wss.on('connection', handleConnection)

  wss.on('error', (error) => {
    console.error('[AgentWS] Server error:', error)
  })

  return wss
}

/**
 * Create a standalone WebSocket server (for development)
 */
export function createStandaloneWSServer(port: number = 3003): WebSocketServer {
  const wss = new WebSocketServer({ port, path: '/agent/ws' })

  console.log(`[AgentWS] Standalone WebSocket server started on ws://localhost:${port}/agent/ws`)

  wss.on('connection', handleConnection)

  wss.on('error', (error) => {
    console.error('[AgentWS] Server error:', error)
  })

  return wss
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { ClientControlMsg, ServerMsg, AgentState, ToolCallRequest, AgentSession }
