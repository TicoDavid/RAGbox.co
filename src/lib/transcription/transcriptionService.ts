/**
 * Meeting Transcription Service — FINAL WAVE Task 10
 *
 * Handles audio file uploads:
 * 1. Detect audio MIME types (mp3, wav, m4a, webm, ogg)
 * 2. Send to Google Cloud Speech-to-Text v2
 * 3. Return transcript text for vault storage + CyGraph extraction
 *
 * The upload handler detects audio files and routes here instead of Document AI.
 */

import { logger } from '@/lib/logger'

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || ''
const GCP_REGION = process.env.GCP_REGION || 'us-east4'

// Audio MIME types we support
const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',       // mp3
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mp4',        // m4a
  'audio/x-m4a',
  'audio/m4a',
  'audio/webm',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
])

// File extensions that indicate audio
const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.m4a', '.webm', '.ogg', '.flac', '.aac', '.wma',
])

/**
 * Check if a file is an audio file by MIME type or extension.
 */
export function isAudioFile(mimeType?: string, fileName?: string): boolean {
  if (mimeType && AUDIO_MIME_TYPES.has(mimeType.toLowerCase())) {
    return true
  }
  if (fileName) {
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
    return AUDIO_EXTENSIONS.has(ext)
  }
  return false
}

/**
 * Map MIME type to Speech-to-Text encoding.
 */
function getEncoding(mimeType: string): string {
  const lower = mimeType.toLowerCase()
  if (lower.includes('flac')) return 'FLAC'
  if (lower.includes('wav')) return 'LINEAR16'
  if (lower.includes('webm')) return 'WEBM_OPUS'
  if (lower.includes('ogg')) return 'OGG_OPUS'
  if (lower.includes('mp3') || lower.includes('mpeg')) return 'MP3'
  if (lower.includes('mp4') || lower.includes('m4a')) return 'MP3' // AAC in MP4 container
  return 'ENCODING_UNSPECIFIED'
}

export interface TranscriptionResult {
  text: string
  durationSeconds: number
  confidence: number
  wordCount: number
}

/**
 * Transcribe an audio file using Google Cloud Speech-to-Text v2.
 * Accepts the audio as a base64-encoded string or Buffer.
 *
 * @param audioData - Audio file content as Buffer
 * @param mimeType - MIME type of the audio
 * @param languageCode - BCP-47 language code (default: en-US)
 */
export async function transcribeAudio(
  audioData: Buffer,
  mimeType: string,
  languageCode = 'en-US',
): Promise<TranscriptionResult> {
  const encoding = getEncoding(mimeType)
  const audioBase64 = audioData.toString('base64')

  // Use Speech-to-Text REST API v1 (widely available)
  const url = `https://speech.googleapis.com/v1/speech:recognize`

  // Get access token from metadata server (Cloud Run) or application default credentials
  const accessToken = await getAccessToken()

  const requestBody = {
    config: {
      encoding,
      languageCode,
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
      model: 'latest_long', // Best for meeting transcription
      useEnhanced: true,
    },
    audio: {
      content: audioBase64,
    },
  }

  // For files > 1 minute, use LongRunningRecognize
  const isLong = audioData.length > 1024 * 1024 // > 1MB likely > 1 minute

  if (isLong) {
    return transcribeLongAudio(requestBody, accessToken)
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    const errText = await res.text()
    logger.error('[Transcription] Speech-to-Text API error:', res.status, errText)
    throw new Error(`Speech-to-Text API error: ${res.status}`)
  }

  const data = await res.json() as {
    results?: Array<{
      alternatives?: Array<{
        transcript?: string
        confidence?: number
        words?: Array<{ endTime?: string }>
      }>
    }>
  }

  return parseTranscriptionResult(data)
}

/**
 * Long audio transcription using LongRunningRecognize.
 */
async function transcribeLongAudio(
  requestBody: Record<string, unknown>,
  accessToken: string,
): Promise<TranscriptionResult> {
  const url = `https://speech.googleapis.com/v1/speech:longrunningrecognize`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    const errText = await res.text()
    logger.error('[Transcription] LongRunning API error:', res.status, errText)
    throw new Error(`LongRunning Speech API error: ${res.status}`)
  }

  const operation = await res.json() as { name?: string; done?: boolean; response?: unknown }

  if (!operation.name) {
    throw new Error('No operation name returned from LongRunningRecognize')
  }

  // Poll for completion (max 5 minutes)
  const pollUrl = `https://speech.googleapis.com/v1/operations/${operation.name}`
  const maxAttempts = 30
  const pollInterval = 10000 // 10 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval))

    const pollRes = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!pollRes.ok) continue

    const status = await pollRes.json() as { done?: boolean; response?: unknown; error?: unknown }

    if (status.error) {
      throw new Error(`Transcription failed: ${JSON.stringify(status.error)}`)
    }

    if (status.done && status.response) {
      return parseTranscriptionResult(status.response as Record<string, unknown>)
    }
  }

  throw new Error('Transcription timed out after 5 minutes')
}

/**
 * Parse the Speech-to-Text API response into our format.
 */
function parseTranscriptionResult(data: Record<string, unknown>): TranscriptionResult {
  const results = (data.results || []) as Array<{
    alternatives?: Array<{
      transcript?: string
      confidence?: number
      words?: Array<{ endTime?: string }>
    }>
  }>

  const transcripts: string[] = []
  let totalConfidence = 0
  let confidenceCount = 0
  let maxEndTime = 0

  for (const result of results) {
    const alt = result.alternatives?.[0]
    if (!alt?.transcript) continue

    transcripts.push(alt.transcript)

    if (alt.confidence !== undefined) {
      totalConfidence += alt.confidence
      confidenceCount++
    }

    // Track duration from word timestamps
    const words = alt.words || []
    for (const word of words) {
      if (word.endTime) {
        const seconds = parseFloat(word.endTime.replace('s', ''))
        if (seconds > maxEndTime) maxEndTime = seconds
      }
    }
  }

  const text = transcripts.join(' ').trim()

  return {
    text,
    durationSeconds: Math.round(maxEndTime),
    confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0.8,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  }
}

/**
 * Get GCP access token from metadata server (Cloud Run) or env.
 */
async function getAccessToken(): Promise<string> {
  // Try metadata server first (Cloud Run / GKE / GCE)
  try {
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      {
        headers: { 'Metadata-Flavor': 'Google' },
        signal: AbortSignal.timeout(2000),
      },
    )
    if (res.ok) {
      const data = await res.json() as { access_token?: string }
      if (data.access_token) return data.access_token
    }
  } catch {
    // Not on GCP — fall through
  }

  // Fallback: use gcloud CLI (development)
  if (GCP_PROJECT) {
    try {
      const { execSync } = await import('child_process')
      const token = execSync('gcloud auth print-access-token', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim()
      if (token) return token
    } catch {
      // gcloud not available
    }
  }

  throw new Error('Unable to obtain GCP access token for Speech-to-Text')
}
