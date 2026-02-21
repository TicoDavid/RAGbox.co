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
import { createInworldSession as createVoiceSession, type InworldSession as VoiceSession } from './inworld'
import { whatsAppEventEmitter, type WhatsAppEvent } from './whatsapp/events'
import { persistThreadMessage } from './thread-persistence'

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

function extractConnectionParams(req: IncomingMessage): ConnectionParams {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`)

    // Extract the token from the Authorization header or query param
    const authHeader = req.headers['authorization']
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : url.searchParams.get('token')

    if (!token) {
      console.warn('[AgentWS] No auth token provided — using anonymous session')
      return { sessionId: null, userId: 'anonymous', role: 'Viewer', privilegeMode: false }
    }

    // TODO: Replace with real Firebase Admin SDK token verification:
    //   const decoded = await admin.auth().verifyIdToken(token)
    //   userId = decoded.uid, role = decoded.role || 'User'
    // For now, extract from query params but enforce role validation.
    const rawRole = url.searchParams.get('role')
    const role = isValidRole(rawRole) ? rawRole : 'User'

    // userId should come from verified token in production.
    // Falling back to query param only for development/testing.
    const userId = url.searchParams.get('userId') || 'anonymous'
    if (userId === 'anonymous') {
      console.warn('[AgentWS] No userId resolved from token — anonymous session')
    }

    return {
      sessionId: url.searchParams.get('sessionId'),
      userId,
      role,
      privilegeMode: url.searchParams.get('privilegeMode') === 'true',
    }
  } catch {
    return { sessionId: null, userId: 'anonymous', role: 'Viewer', privilegeMode: false }
  }
}

// ============================================================================
// WEBSOCKET CONNECTION HANDLER
// ============================================================================

async function handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
  const params = extractConnectionParams(req)
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
    // Create voice session (Inworld Graph pipeline — Plan B per CPO directive)
    const inworldKey = process.env.INWORLD_API_KEY || ''
    const voiceSession = await createVoiceSession({
      apiKey: inworldKey,
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

    // Handle disconnection
    ws.on('close', async (code, reason) => {
      console.info('[AgentWS] Connection closed', { sessionId, code, reason: reason.toString() })
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
