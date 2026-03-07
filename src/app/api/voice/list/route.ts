/**
 * Voice List API — EPIC-028 Voice Library
 *
 * GET /api/voice/list
 *
 * Returns full voice catalog with metadata (gender, language, accent, tags).
 * Fetches from Inworld API at runtime, falls back to hardcoded catalog.
 */

import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

interface VoiceEntry {
  id: string
  label: string
  description: string
  gender: 'female' | 'male'
  language: string
  accent?: string
  tags: string[]
  sampleText?: string
}

const INWORLD_VOICES_URL = 'https://api.inworld.ai/tts/v1/voices'

// Full Inworld TTS-1.5-max English voice catalog
const VOICE_CATALOG: VoiceEntry[] = [
  { id: 'Ashley', label: 'Ashley', description: 'Warm conversationalist', gender: 'female', language: 'en-US', accent: 'American', tags: ['warm', 'professional', 'conversational'], sampleText: 'Welcome to RAGbox. How can I help you explore your documents today?' },
  { id: 'Elizabeth', label: 'Elizabeth', description: 'Professional narrator', gender: 'female', language: 'en-US', accent: 'American', tags: ['formal', 'clear', 'authoritative'], sampleText: 'Your document analysis is complete. Here are the key findings.' },
  { id: 'Olivia', label: 'Olivia', description: 'Friendly British warmth', gender: 'female', language: 'en-GB', accent: 'British', tags: ['british', 'warm', 'friendly'], sampleText: 'I found several relevant passages in your uploaded documents.' },
  { id: 'Luna', label: 'Luna', description: 'Calm meditation guide', gender: 'female', language: 'en-US', accent: 'American', tags: ['calm', 'soothing', 'gentle'], sampleText: 'Let me walk you through what I found in your vault.' },
  { id: 'Dennis', label: 'Dennis', description: 'Authoritative deep voice', gender: 'male', language: 'en-US', accent: 'American', tags: ['authoritative', 'deep', 'professional'], sampleText: 'I have analyzed the documents and prepared a detailed summary.' },
  { id: 'Mark', label: 'Mark', description: 'Calm, measured tone', gender: 'male', language: 'en-US', accent: 'American', tags: ['calm', 'measured', 'steady'], sampleText: 'Here is what your documents reveal about this topic.' },
  { id: 'James', label: 'James', description: 'Classic professional', gender: 'male', language: 'en-US', accent: 'American', tags: ['professional', 'clear', 'classic'], sampleText: 'The relevant sections of your documents indicate the following.' },
  { id: 'Brian', label: 'Brian', description: 'Technical expert', gender: 'male', language: 'en-US', accent: 'American', tags: ['precise', 'measured', 'technical'], sampleText: 'The technical details in your documents specify the following parameters.' },
]

// Index by ID for merging with dynamic API results
const CATALOG_BY_ID = new Map(VOICE_CATALOG.map(v => [v.id, v]))

// Cache: 5-minute TTL
let cachedVoices: VoiceEntry[] | null = null
let cacheExpiresAt = 0

export async function GET(): Promise<NextResponse> {
  if (cachedVoices && Date.now() < cacheExpiresAt) {
    return NextResponse.json({ success: true, data: { voices: cachedVoices } })
  }

  const apiKey = process.env.INWORLD_API_KEY
  if (!apiKey) {
    return NextResponse.json({ success: true, data: { voices: VOICE_CATALOG, source: 'catalog' } })
  }

  try {
    const res = await fetch(INWORLD_VOICES_URL, {
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      logger.warn('[VOICE-LIST] Inworld API returned non-OK', { status: res.status, body: errText.slice(0, 200) })
      return NextResponse.json({ success: true, data: { voices: VOICE_CATALOG, source: 'catalog' } })
    }

    const json = await res.json() as { voices?: Array<{ voiceId: string; displayName?: string }> }
    const apiVoices = json.voices || []

    if (apiVoices.length === 0) {
      return NextResponse.json({ success: true, data: { voices: VOICE_CATALOG, source: 'catalog' } })
    }

    // Merge API voices with catalog metadata
    const voices: VoiceEntry[] = apiVoices.map((v) => {
      const catalogEntry = CATALOG_BY_ID.get(v.voiceId)
      if (catalogEntry) return catalogEntry
      return {
        id: v.voiceId,
        label: v.displayName || v.voiceId,
        description: '',
        gender: 'female' as const,
        language: 'en-US',
        tags: [],
      }
    })

    cachedVoices = voices
    cacheExpiresAt = Date.now() + 5 * 60 * 1000

    logger.info('[VOICE-LIST] Inworld API returned voices', { count: voices.length, catalogOverlap: voices.filter(v => CATALOG_BY_ID.has(v.id)).length })
    return NextResponse.json({ success: true, data: { voices, source: 'inworld' } })
  } catch (err) {
    logger.warn('[VOICE-LIST] Inworld API fetch failed', { error: err instanceof Error ? err.message : 'unknown' })
    return NextResponse.json({ success: true, data: { voices: VOICE_CATALOG, source: 'catalog' } })
  }
}
