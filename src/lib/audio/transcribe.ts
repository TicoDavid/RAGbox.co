/**
 * Audio Transcription — Deepgram STT
 *
 * Transcribes WAV audio buffers to text using the Deepgram API.
 * Used by WhatsApp voice message processing.
 *
 * S-P0-03
 */

import { logger } from '@/lib/logger'

const DEEPGRAM_STT_URL = 'https://api.deepgram.com/v1/listen'

/**
 * Transcribe a WAV audio buffer to text using Deepgram.
 * Returns the transcribed text, or null if transcription fails/empty.
 */
export async function transcribeAudio(wavBuffer: Buffer): Promise<string | null> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    logger.error('[Transcribe] DEEPGRAM_API_KEY not configured')
    return null
  }

  try {
    const params = new URLSearchParams({
      model: 'nova-2',
      language: 'en',
      punctuate: 'true',
      smart_format: 'true',
    })

    const response = await fetch(`${DEEPGRAM_STT_URL}?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'audio/wav',
      },
      body: new Uint8Array(wavBuffer),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('[Transcribe] Deepgram error', { status: response.status, error: errorText })
      return null
    }

    const data = await response.json() as {
      results?: {
        channels?: Array<{
          alternatives?: Array<{
            transcript?: string
            confidence?: number
          }>
        }>
      }
    }

    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript
    if (!transcript || transcript.trim().length === 0) {
      logger.info('[Transcribe] Empty transcription result')
      return null
    }

    logger.info('[Transcribe] Success', { length: transcript.length })
    return transcript.trim()
  } catch (error) {
    logger.error('[Transcribe] Error:', error)
    return null
  }
}
