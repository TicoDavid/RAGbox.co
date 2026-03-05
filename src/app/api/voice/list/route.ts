/**
 * Voice List API — EPIC-022 V-005
 *
 * GET /api/voice/list
 *
 * Fetches available TTS voices from Inworld API at runtime.
 * Falls back to hardcoded defaults if API is unreachable.
 * Response shape matches Jordan's Settings V2 frontend expectations.
 */

import { NextResponse } from 'next/server'

const INWORLD_VOICES_URL = 'https://api.inworld.ai/tts/v1/voices'

// Static fallback when Inworld API is unreachable
const FALLBACK_VOICES = [
  { id: 'Ashley', label: 'Ashley', description: 'Warm, professional' },
  { id: 'Dennis', label: 'Dennis', description: 'Authoritative, deep' },
  { id: 'Luna', label: 'Luna', description: 'Friendly, approachable' },
  { id: 'Mark', label: 'Mark', description: 'Calm, measured' },
]

// Cache: 5-minute TTL to avoid hammering Inworld on every Settings page load
let cachedVoices: Array<{ id: string; label: string; description: string }> | null = null
let cacheExpiresAt = 0

export async function GET(): Promise<NextResponse> {
  // Return cached list if fresh
  if (cachedVoices && Date.now() < cacheExpiresAt) {
    return NextResponse.json({ success: true, data: { voices: cachedVoices } })
  }

  const apiKey = process.env.INWORLD_API_KEY
  if (!apiKey) {
    console.warn('[Voice/List] INWORLD_API_KEY not set — returning 4 fallback voices')
    return NextResponse.json({ success: true, data: { voices: FALLBACK_VOICES, source: 'fallback' } })
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
      console.warn(`[Voice/List] Inworld API returned ${res.status}, using fallback`)
      return NextResponse.json({ success: true, data: { voices: FALLBACK_VOICES } })
    }

    const json = await res.json() as { voices?: Array<{ voiceId: string; displayName?: string }> }
    const voices = (json.voices || []).map((v) => ({
      id: v.voiceId,
      label: v.displayName || v.voiceId,
      description: '',
    }))

    if (voices.length === 0) {
      return NextResponse.json({ success: true, data: { voices: FALLBACK_VOICES } })
    }

    // Cache for 5 minutes
    cachedVoices = voices
    cacheExpiresAt = Date.now() + 5 * 60 * 1000

    return NextResponse.json({ success: true, data: { voices, source: 'inworld' } })
  } catch (err) {
    console.warn('[Voice/List] Inworld API unreachable, using fallback', err)
    return NextResponse.json({ success: true, data: { voices: FALLBACK_VOICES } })
  }
}
