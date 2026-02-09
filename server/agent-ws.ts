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
import { executeTool, type ToolCall, type ToolResult, type ToolContext } from './tools'
import { checkToolPermission, createConfirmationRequest, storePendingConfirmation } from './tools/permissions'
import * as obs from './observability'
import { createInworldSession, type InworldSession } from './inworld'

// ============================================================================
// TYPES
// ============================================================================

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
  toolContext: ToolContext
  inworldSession?: InworldSession
  isAudioSessionActive: boolean
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
      session.inworldSession?.close()
      session.ws.close(1000, 'Session expired')
      sessions.delete(sessionId)
    }
  }
}, 60_000)

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
    isAudioSessionActive: false,
  }
  sessions.set(sessionId, session)

  // Send connecting state
  sendJSON(ws, { type: 'state', state: 'connecting' })

  try {
    // Get Inworld config from environment (base64 format API key)
    const apiKey = process.env.INWORLD_API_KEY

    if (!apiKey) {
      throw new Error('Missing INWORLD_API_KEY environment variable')
    }

    // Create Inworld session with callbacks
    const inworldSession = await createInworldSession({
      apiKey,

      onTranscriptPartial: (text) => {
        sendJSON(ws, { type: 'asr_partial', text })
      },

      onTranscriptFinal: (text) => {
        sendJSON(ws, { type: 'asr_final', text })
        obs.logTranscript(sessionId, 'user', text, true)
        obs.incrementTurn(sessionId)
      },

      onAgentTextPartial: (text) => {
        sendJSON(ws, { type: 'agent_text_partial', text })
        if (session.state !== 'speaking') {
          session.state = 'speaking'
          sendJSON(ws, { type: 'state', state: 'speaking' })
          obs.recordFirstToken(sessionId)
        }
      },

      onAgentTextFinal: (text) => {
        sendJSON(ws, { type: 'agent_text_final', text })
        obs.logTranscript(sessionId, 'agent', text, true)
      },

      onTTSChunk: (audioBase64) => {
        // Convert base64 to buffer and send as binary
        const audioBuffer = Buffer.from(audioBase64, 'base64')
        sendBinary(ws, audioBuffer)
        obs.recordFirstAudio(sessionId)
      },

      onError: (error) => {
        console.error(`[AgentWS] Inworld error for ${sessionId}:`, error)
        obs.incrementError(sessionId)
        sendJSON(ws, { type: 'error', message: error.message })
      },

      onDisconnect: () => {
        console.log(`[AgentWS] Inworld disconnected for ${sessionId}`)
        session.state = 'error'
        sendJSON(ws, { type: 'state', state: 'error' })
      },
    })

    session.inworldSession = inworldSession

    // Ready to receive audio
    session.state = 'idle'
    sendJSON(ws, { type: 'state', state: 'idle' })

    // Handle incoming messages
    ws.on('message', async (data, isBinary) => {
      session.lastActivity = Date.now()

      if (isBinary) {
        // Binary = audio chunk from client microphone
        if (session.inworldSession && session.isAudioSessionActive) {
          try {
            await session.inworldSession.sendAudio(data as Buffer)
          } catch (error) {
            console.error('[AgentWS] Error sending audio:', error)
          }
        }
        return
      }

      // Text = control message
      try {
        const msg = JSON.parse(data.toString()) as ClientControlMsg

        switch (msg.type) {
          case 'start':
            if (session.inworldSession && !session.isAudioSessionActive) {
              await session.inworldSession.startAudioSession()
              session.isAudioSessionActive = true
              session.state = 'listening'
              sendJSON(ws, { type: 'state', state: 'listening' })
              obs.logAudioEvent(sessionId, 'mic_start')
            }
            break

          case 'stop':
            if (session.inworldSession && session.isAudioSessionActive) {
              await session.inworldSession.endAudioSession()
              session.isAudioSessionActive = false
              session.state = 'processing'
              sendJSON(ws, { type: 'state', state: 'processing' })
              obs.logAudioEvent(sessionId, 'mic_stop')
            }
            break

          case 'barge_in':
            if (session.inworldSession) {
              await session.inworldSession.cancelResponse()
              obs.incrementBargeIn(sessionId)
              obs.logAudioEvent(sessionId, 'barge_in')
              session.state = 'listening'
              sendJSON(ws, { type: 'state', state: 'listening' })
            }
            break

          case 'text':
            // Allow sending text directly (for testing or accessibility)
            if (session.inworldSession && msg.text) {
              await session.inworldSession.sendText(msg.text)
              session.state = 'processing'
              sendJSON(ws, { type: 'state', state: 'processing' })
            }
            break

          case 'tool_result':
            // Tool results from client confirmations
            console.log(`[AgentWS] Tool result received: ${msg.name}`)
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
      session.inworldSession?.close()
      sessions.delete(sessionId)
    })

    ws.on('error', (error) => {
      console.error(`[AgentWS] WebSocket error for ${sessionId}:`, error)
      obs.incrementError(sessionId)
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
