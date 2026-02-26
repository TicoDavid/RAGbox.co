/**
 * Agent WebSocket Server - RAGbox.co
 *
 * Full-duplex WebSocket spine for voice AI:
 * Browser ⇄ This Server ⇄ Inworld STT + Go LLM + Inworld TTS (v3)
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
import { getToken } from 'next-auth/jwt'
import jwt from 'jsonwebtoken'
import { executeTool, type ToolCall, type ToolResult, type ToolContext } from './tools'
import { checkToolPermission, createConfirmationRequest, storePendingConfirmation } from './tools/permissions'
import * as obs from './observability'
import { createVoiceSession, type VoiceSession } from './voice-pipeline-v3'
import { whatsAppEventEmitter, type WhatsAppEvent } from './whatsapp/events'
import { persistThreadMessage } from './thread-persistence'
import { validateSession } from '../src/app/api/agent/session/session-store'

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
  | 'executing'
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
  voiceSession?: VoiceSession
  isAudioSessionActive: boolean
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

const sessions = new Map<string, AgentSession>()
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const PING_INTERVAL_MS = 25_000  // 25s — Cloud Run kills idle WS after ~60s
const PONG_TIMEOUT_MS = 10_000   // 10s — dead connection detection

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now()
  for (const [sessionId, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      console.info('[AgentWS] Cleaning up expired session', { sessionId })
      session.voiceSession?.close()
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

/**
 * Validate role is a known value to prevent injection of arbitrary roles.
 */
function isValidRole(role: string | null): role is ConnectionParams['role'] {
  return role === 'User' || role === 'Admin' || role === 'Viewer'
}

/**
 * STORY-S02: Authenticate WebSocket connections server-side.
 *
 * Two auth paths (tried in order):
 * 1. Session token — client calls POST /api/agent/session (NextAuth-protected),
 *    receives a sessionId, passes it as ?sessionId=<id>. We validate via the
 *    in-memory session store (works when WS + Next.js share one process).
 * 2. NextAuth JWT cookie — browser sends cookies automatically on WS upgrade.
 *    We decode the JWT using NEXTAUTH_SECRET to extract userId.
 *
 * Returns null if neither path succeeds → caller rejects with close code 4001.
 */
async function extractConnectionParams(req: IncomingMessage): Promise<ConnectionParams | null> {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`)

    // ── Path 0 (BUG-041): Voice JWT token — cross-service auth ──────
    // mercury-voice is a separate Cloud Run service that can't access
    // ragbox-app's in-memory session store or NextAuth cookies (different domain).
    // The JWT is signed by ragbox-app /api/agent/session with VOICE_JWT_SECRET.
    const token = url.searchParams.get('token')
    if (token) {
      const voiceJwtSecret = process.env.VOICE_JWT_SECRET
      if (voiceJwtSecret) {
        try {
          const decoded = jwt.verify(token, voiceJwtSecret) as {
            userId: string
            role: string
          }
          console.info('[AgentWS] JWT validated — userId:', decoded.userId, 'role:', decoded.role)
          return {
            sessionId: null,
            userId: decoded.userId,
            role: isValidRole(decoded.role) ? decoded.role : 'User',
            privilegeMode: false,
          }
        } catch (err) {
          console.warn('[AgentWS] Voice JWT validation failed:', err instanceof Error ? err.message : err)
          // Fall through to other auth paths
        }
      }
    }

    // ── Path 1: Session token from POST /api/agent/session ──────────
    const sessionId = url.searchParams.get('sessionId')
    if (sessionId) {
      const result = validateSession(sessionId)
      if (result.valid && result.userId) {
        console.info('[AgentWS] Authenticated via session token', { sessionId, userId: result.userId })
        return {
          sessionId,
          userId: result.userId,
          role: 'User',           // Default role; session bootstrap is already NextAuth-protected
          privilegeMode: false,   // Server-side state (STORY-S01)
        }
      }
      console.warn('[AgentWS] Invalid or expired session token', { sessionId })
    }

    // ── Path 2: NextAuth JWT cookie (auto-sent by browser on WS upgrade) ──
    const secret = process.env.NEXTAUTH_SECRET
    if (secret && req.headers.cookie) {
      try {
        const token = await getToken({ req: req as any, secret })
        if (token && (token.id || token.email)) {
          const userId = (token.id as string) || (token.email as string)
          console.info('[AgentWS] Authenticated via NextAuth JWT cookie', { userId })
          return {
            sessionId: sessionId || null,
            userId,
            role: 'User',
            privilegeMode: false,
          }
        }
      } catch (err) {
        console.warn('[AgentWS] NextAuth JWT cookie validation failed:', err)
      }
    }

    // ── No valid auth ───────────────────────────────────────────────
    console.warn('[AgentWS] Authentication failed — no valid session or JWT')
    return null
  } catch (err) {
    console.error('[AgentWS] Error during authentication:', err)
    return null
  }
}

// ============================================================================
// WEBSOCKET CONNECTION HANDLER
// ============================================================================

async function handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
  // STORY-S02: Authenticate before allowing connection
  const params = await extractConnectionParams(req)
  if (!params) {
    console.warn('[AgentWS] Rejecting unauthenticated WebSocket connection')
    ws.close(4001, 'Unauthorized')
    return
  }

  const sessionId = params.sessionId || generateSessionId()

  console.info('[AgentWS] New connection', { sessionId, userId: params.userId, role: params.role })

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

  // State transition helper with logging
  const setState = (newState: AgentState): void => {
    const prev = session.state
    session.state = newState
    console.info(`[AgentWS] State: ${prev} → ${newState}`, { sessionId })
    sendJSON(ws, { type: 'state', state: newState })
  }

  // Send connecting state
  setState('connecting')

  try {
    // Create voice session (v3 hybrid: Inworld STT + Go LLM + Inworld TTS)
    const voiceSession = await createVoiceSession({
      toolContext,

      onTranscriptPartial: (text) => {
        sendJSON(ws, { type: 'asr_partial', text })
      },

      onTranscriptFinal: (text) => {
        sendJSON(ws, { type: 'asr_final', text })
        obs.logTranscript(sessionId, 'user', text, true)
        obs.incrementTurn(sessionId)
        // Persist user voice message to unified thread (fire-and-forget)
        persistThreadMessage({
          userId: params.userId,
          role: 'user',
          channel: 'voice',
          content: text,
          direction: 'inbound',
          metadata: { sessionId },
        })
      },

      onAgentTextPartial: (text) => {
        sendJSON(ws, { type: 'agent_text_partial', text })
        if (session.state !== 'speaking') {
          setState('speaking')
          obs.recordFirstToken(sessionId)
        }
      },

      onAgentTextFinal: (text) => {
        sendJSON(ws, { type: 'agent_text_final', text })
        obs.logTranscript(sessionId, 'agent', text, true)
        // Persist assistant voice response to unified thread (fire-and-forget)
        persistThreadMessage({
          userId: params.userId,
          role: 'assistant',
          channel: 'voice',
          content: text,
          direction: 'outbound',
          metadata: { sessionId },
        })
      },

      onTTSChunk: (audioBase64) => {
        // Convert base64 to buffer and send as binary
        const audioBuffer = Buffer.from(audioBase64, 'base64')
        sendBinary(ws, audioBuffer)
        obs.recordFirstAudio(sessionId)
      },

      onToolCall: (toolName, args) => {
        console.info('[AgentWS] Tool call', { toolName, args })
        sendJSON(ws, {
          type: 'tool_call',
          call: { id: `tool_${Date.now()}`, name: toolName, parameters: args }
        })
        setState('executing')
      },

      onToolResult: (toolName, result) => {
        console.info('[AgentWS] Tool result', { toolName })
        sendJSON(ws, { type: 'tool_result', result: result as ToolResult })
      },

      onUIAction: (action) => {
        console.info('[AgentWS] UI action', { action })
        sendJSON(ws, { type: 'ui_action', action })
      },

      onNoSpeech: () => {
        console.info('[AgentWS] No speech detected', { sessionId })
        sendJSON(ws, { type: 'agent_text_final', text: "I didn't catch that. Could you try again?" })
        setState('idle')
      },

      onSpeakingComplete: () => {
        // TTS playback finished — transition back to idle so client can start listening
        setState('idle')
      },

      onError: (error) => {
        console.error(`[AgentWS] Voice pipeline error for ${sessionId}:`, error)
        obs.incrementError(sessionId)
        sendJSON(ws, { type: 'error', message: error.message })
      },

      onDisconnect: () => {
        console.info('[AgentWS] Voice session ended', { sessionId })
        setState('error')
      },
    })

    session.voiceSession = voiceSession

    // Ready to receive audio
    setState('idle')

    // Register message handler BEFORE greeting so messages aren't lost during TTS
    ws.on('message', async (data, isBinary) => {
      session.lastActivity = Date.now()

      if (isBinary) {
        // Binary = audio chunk from client microphone
        if (session.voiceSession && session.isAudioSessionActive) {
          try {
            await session.voiceSession.sendAudio(data as Buffer)
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
            if (session.voiceSession && !session.isAudioSessionActive) {
              await session.voiceSession.startAudioSession()
              session.isAudioSessionActive = true
              setState('listening')
              obs.logAudioEvent(sessionId, 'mic_start')
            }
            break

          case 'stop':
            if (session.voiceSession && session.isAudioSessionActive) {
              session.isAudioSessionActive = false
              setState('processing')
              obs.logAudioEvent(sessionId, 'mic_stop')
              await session.voiceSession.endAudioSession()
              // Pipeline complete — onSpeakingComplete already set idle,
              // but ensure idle in case pipeline had no TTS output
              if (session.state !== 'idle') {
                setState('idle')
              }
            }
            break

          case 'barge_in':
            if (session.voiceSession) {
              await session.voiceSession.cancelResponse()
              obs.incrementBargeIn(sessionId)
              obs.logAudioEvent(sessionId, 'barge_in')
              setState('listening')
            }
            break

          case 'text':
            // Allow sending text directly (for testing or accessibility)
            if (session.voiceSession && msg.text) {
              setState('processing')
              await session.voiceSession.sendText(msg.text)
              // onSpeakingComplete handles transition back to idle
            }
            break

          case 'tool_result':
            // Tool results from client confirmations
            console.info('[AgentWS] Tool result received', { name: msg.name })
            break

          default:
            console.warn('[AgentWS] Unknown message type:', msg)
        }
      } catch (error) {
        console.error('[AgentWS] Error parsing message:', error)
        sendJSON(ws, { type: 'error', message: 'Invalid message format' })
      }
    })

    // Subscribe to WhatsApp events for this user
    const onWhatsAppEvent = (event: WhatsAppEvent) => {
      if (event.userId === params.userId) {
        sendJSON(ws, {
          type: 'ui_action',
          action: { kind: 'whatsapp_event', eventType: event.type, conversationId: event.conversationId, data: event.data },
        })
      }
    }
    whatsAppEventEmitter.on('message', onWhatsAppEvent)

    // Send initial greeting from Mercury (fire-and-forget so it doesn't block message handling)
    console.info('[AgentWS] Sending initial greeting', { sessionId })
    voiceSession.triggerGreeting().catch((greetError) => {
      console.warn('[AgentWS] Failed to send initial greeting:', greetError)
    })

    // ── Keepalive (ping/pong) ─────────────────────────────
    // Cloud Run closes idle WebSockets after ~60s. Ping every 25s to stay alive.
    let isAlive = true
    ws.on('pong', () => { isAlive = true })

    const pingInterval = setInterval(() => {
      if (!isAlive) {
        console.warn('[AgentWS] No pong received — terminating dead connection', { sessionId })
        ws.terminate()
        return
      }
      isAlive = false
      ws.ping()
    }, PING_INTERVAL_MS)

    // Handle disconnection
    ws.on('close', async (code, reason) => {
      console.info('[AgentWS] Connection closed', { sessionId, code, reason: reason.toString() })
      clearInterval(pingInterval)
      whatsAppEventEmitter.off('message', onWhatsAppEvent)
      obs.endSession(sessionId)
      session.voiceSession?.close()
      sessions.delete(sessionId)
    })

    ws.on('error', (error) => {
      console.error(`[AgentWS] WebSocket error for ${sessionId}:`, error)
      obs.incrementError(sessionId)
      setState('error')
      sendJSON(ws, { type: 'error', message: error.message })
    })

  } catch (error) {
    console.error('[AgentWS] Failed to initialize session:', error)
    setState('error')
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

  console.info('[AgentWS] WebSocket server started', { path: '/agent/ws' })

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

  console.info('[AgentWS] Standalone WebSocket server started', { port, path: '/agent/ws' })

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
