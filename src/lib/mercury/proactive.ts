/**
 * Mercury Proactive Events — EPIC-029
 *
 * Dispatches proactive notifications to the Mercury chat UI when
 * background events occur (document upload complete, insights, etc).
 * Server-side functions build event payloads; client-side dispatch
 * pushes them into the mercuryStore.
 */

export interface ProactiveEvent {
  type: 'upload_complete' | 'insight' | 'action_result' | 'reminder'
  content: string
  metadata?: Record<string, unknown>
  timestamp: Date
}

/**
 * Build a proactive event for when a document upload + pipeline completes.
 */
export function buildUploadCompleteEvent(params: {
  documentName: string
  documentId: string
  chunkCount?: number
}): ProactiveEvent {
  const { documentName, chunkCount } = params
  const chunkInfo = chunkCount ? ` (${chunkCount} chunks indexed)` : ''
  return {
    type: 'upload_complete',
    content: `Your document "${documentName}" has been processed and is ready for queries${chunkInfo}.`,
    metadata: { documentId: params.documentId, chunkCount },
    timestamp: new Date(),
  }
}

/**
 * Build a proactive event for an insight notification.
 */
export function buildInsightEvent(params: {
  title: string
  summary: string
  insightType: string
}): ProactiveEvent {
  return {
    type: 'insight',
    content: `${params.title}: ${params.summary}`,
    metadata: { insightType: params.insightType },
    timestamp: new Date(),
  }
}

/**
 * Dispatch a proactive event to the Mercury store (client-side only).
 * Safe to call from any client module — no-ops if store is not available.
 */
export function dispatchProactiveEvent(event: ProactiveEvent): void {
  try {
    // Dynamic import avoids server-side Zustand reference
    const { useMercuryStore } = require('@/stores/mercuryStore')
    useMercuryStore.getState().addProactiveMessage({
      content: event.content,
      proactiveType: event.type,
      timestamp: event.timestamp,
    })
  } catch {
    // Server-side or store not initialized — silent no-op
  }
}
