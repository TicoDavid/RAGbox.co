/**
 * Voice Session Observability - RAGbox.co
 *
 * Logging and metrics for voice agent sessions.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SessionMetrics {
  sessionId: string
  userId: string
  startedAt: number
  endedAt?: number
  // Timing metrics
  firstTokenLatencyMs?: number
  firstAudioLatencyMs?: number
  totalDurationMs?: number
  // Counts
  turnCount: number
  toolCallCount: number
  bargeInCount: number
  errorCount: number
}

export interface ToolCallLog {
  sessionId: string
  toolCallId: string
  toolName: string
  arguments: Record<string, unknown>
  startedAt: number
  completedAt?: number
  success?: boolean
  error?: string
  latencyMs?: number
}

export interface TranscriptLog {
  sessionId: string
  timestamp: number
  speaker: 'user' | 'agent'
  text: string
  isFinal: boolean
}

export interface AudioTimingLog {
  sessionId: string
  timestamp: number
  event: 'mic_start' | 'mic_stop' | 'tts_start' | 'tts_end' | 'barge_in'
  durationMs?: number
}

// ============================================================================
// IN-MEMORY STORE (replace with BigQuery/Cloud Logging in production)
// ============================================================================

const sessionMetrics = new Map<string, SessionMetrics>()
const toolCallLogs: ToolCallLog[] = []
const transcriptLogs: TranscriptLog[] = []
const audioTimingLogs: AudioTimingLog[] = []

// ============================================================================
// SESSION METRICS
// ============================================================================

export function initSession(sessionId: string, userId: string): SessionMetrics {
  const metrics: SessionMetrics = {
    sessionId,
    userId,
    startedAt: Date.now(),
    turnCount: 0,
    toolCallCount: 0,
    bargeInCount: 0,
    errorCount: 0,
  }
  sessionMetrics.set(sessionId, metrics)
  console.log(`[Observability] Session started: ${sessionId} (user: ${userId})`)
  return metrics
}

export function endSession(sessionId: string): SessionMetrics | undefined {
  const metrics = sessionMetrics.get(sessionId)
  if (metrics) {
    metrics.endedAt = Date.now()
    metrics.totalDurationMs = metrics.endedAt - metrics.startedAt
    console.log(`[Observability] Session ended: ${sessionId} (duration: ${metrics.totalDurationMs}ms, turns: ${metrics.turnCount}, tools: ${metrics.toolCallCount})`)
  }
  return metrics
}

export function recordFirstToken(sessionId: string): void {
  const metrics = sessionMetrics.get(sessionId)
  if (metrics && !metrics.firstTokenLatencyMs) {
    metrics.firstTokenLatencyMs = Date.now() - metrics.startedAt
    console.log(`[Observability] First token latency: ${metrics.firstTokenLatencyMs}ms`)
  }
}

export function recordFirstAudio(sessionId: string): void {
  const metrics = sessionMetrics.get(sessionId)
  if (metrics && !metrics.firstAudioLatencyMs) {
    metrics.firstAudioLatencyMs = Date.now() - metrics.startedAt
    console.log(`[Observability] First audio latency: ${metrics.firstAudioLatencyMs}ms`)
  }
}

export function incrementTurn(sessionId: string): void {
  const metrics = sessionMetrics.get(sessionId)
  if (metrics) metrics.turnCount++
}

export function incrementBargeIn(sessionId: string): void {
  const metrics = sessionMetrics.get(sessionId)
  if (metrics) metrics.bargeInCount++
}

export function incrementError(sessionId: string): void {
  const metrics = sessionMetrics.get(sessionId)
  if (metrics) metrics.errorCount++
}

// ============================================================================
// TOOL CALL LOGGING
// ============================================================================

export function logToolCallStart(
  sessionId: string,
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>
): void {
  const metrics = sessionMetrics.get(sessionId)
  if (metrics) metrics.toolCallCount++

  toolCallLogs.push({
    sessionId,
    toolCallId,
    toolName,
    arguments: args,
    startedAt: Date.now(),
  })

  console.log(`[Observability] Tool call started: ${toolName} (${toolCallId})`)
}

export function logToolCallEnd(
  toolCallId: string,
  success: boolean,
  error?: string
): void {
  const log = toolCallLogs.find(l => l.toolCallId === toolCallId)
  if (log) {
    log.completedAt = Date.now()
    log.success = success
    log.error = error
    log.latencyMs = log.completedAt - log.startedAt
    console.log(`[Observability] Tool call ended: ${log.toolName} (${success ? 'success' : 'error'}, ${log.latencyMs}ms)`)
  }
}

// ============================================================================
// TRANSCRIPT LOGGING
// ============================================================================

export function logTranscript(
  sessionId: string,
  speaker: 'user' | 'agent',
  text: string,
  isFinal: boolean
): void {
  if (!isFinal) return // Only log final transcripts

  transcriptLogs.push({
    sessionId,
    timestamp: Date.now(),
    speaker,
    text,
    isFinal,
  })

  console.log(`[Observability] Transcript [${speaker}]: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`)
}

// ============================================================================
// AUDIO TIMING LOGGING
// ============================================================================

export function logAudioEvent(
  sessionId: string,
  event: AudioTimingLog['event'],
  durationMs?: number
): void {
  audioTimingLogs.push({
    sessionId,
    timestamp: Date.now(),
    event,
    durationMs,
  })

  console.log(`[Observability] Audio event: ${event}${durationMs ? ` (${durationMs}ms)` : ''}`)
}

// ============================================================================
// EXPORT FOR ANALYSIS
// ============================================================================

export function getSessionMetrics(sessionId: string): SessionMetrics | undefined {
  return sessionMetrics.get(sessionId)
}

export function getAllMetrics(): {
  sessions: SessionMetrics[]
  toolCalls: ToolCallLog[]
  transcripts: TranscriptLog[]
  audioTimings: AudioTimingLog[]
} {
  return {
    sessions: Array.from(sessionMetrics.values()),
    toolCalls: [...toolCallLogs],
    transcripts: [...transcriptLogs],
    audioTimings: [...audioTimingLogs],
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

export function cleanupOldLogs(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const cutoff = Date.now() - maxAgeMs

  // Clean sessions
  for (const [id, metrics] of sessionMetrics) {
    if (metrics.endedAt && metrics.endedAt < cutoff) {
      sessionMetrics.delete(id)
    }
  }

  // Clean tool calls
  const toolCutoffIdx = toolCallLogs.findIndex(l => l.startedAt >= cutoff)
  if (toolCutoffIdx > 0) toolCallLogs.splice(0, toolCutoffIdx)

  // Clean transcripts
  const transcriptCutoffIdx = transcriptLogs.findIndex(l => l.timestamp >= cutoff)
  if (transcriptCutoffIdx > 0) transcriptLogs.splice(0, transcriptCutoffIdx)

  // Clean audio timings
  const audioCutoffIdx = audioTimingLogs.findIndex(l => l.timestamp >= cutoff)
  if (audioCutoffIdx > 0) audioTimingLogs.splice(0, audioCutoffIdx)
}

// Run cleanup every hour
setInterval(() => cleanupOldLogs(), 60 * 60 * 1000)
