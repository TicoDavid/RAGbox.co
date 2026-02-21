/**
 * Test Inworld API key — validates the key works with REST API
 * Run: npx tsx scripts/test-inworld-key.ts
 *
 * Correct Inworld TTS REST API format (flat, camelCase):
 *   POST https://api.inworld.ai/tts/v1/voice
 *   { text, voiceId, modelId }
 *   Authorization: Basic <base64-key>
 */
import 'dotenv/config'

async function main() {
  const INWORLD_API_KEY = process.env.INWORLD_API_KEY
  if (!INWORLD_API_KEY) {
    console.error('INWORLD_API_KEY not set')
    process.exit(1)
  }

  console.log('Key preview:', INWORLD_API_KEY.substring(0, 20) + '...')
  console.log('Key length:', INWORLD_API_KEY.length)
  console.log('Looks like base64:', /^[A-Za-z0-9+/=]+$/.test(INWORLD_API_KEY))

  // Test 1: REST API — TTS synthesis
  console.log('\n--- Test 1: Inworld TTS REST API ---')
  try {
    const res = await fetch('https://api.inworld.ai/tts/v1/voice', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${INWORLD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Hello, this is Mercury speaking.',
        voiceId: 'Ashley',
        modelId: 'inworld-tts-1-max',
      }),
    })
    console.log('Status:', res.status)
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>
      const audioContent = data.audioContent as string | undefined
      console.log('Has audio:', !!audioContent)
      if (audioContent) {
        const audioBytes = Buffer.from(audioContent, 'base64')
        console.log('Audio size:', audioBytes.length, 'bytes')
        console.log('Duration estimate:', (audioBytes.length / (48000 * 2)).toFixed(1), 'seconds')
        console.log('PASS: INWORLD TTS WORKS')
      } else {
        console.log('Response keys:', Object.keys(data))
        console.log('FAIL: No audio content in response')
      }
    } else {
      const errText = await res.text()
      console.log('Error:', errText.substring(0, 500))
      console.log('FAIL: INWORLD TTS FAILED')
      console.log('')
      console.log('If 401/403: Key is wrong. Go to https://portal.inworld.ai -> Settings -> API Keys')
      console.log('If 400: Request format may have changed. Check https://docs.inworld.ai/docs/tts-api/reference/')
    }
  } catch (error) {
    console.error('Network error:', error)
    console.log('FAIL: Cannot reach Inworld API — check network/VPC')
  }

  // Test 2: List available voices
  console.log('\n--- Test 2: List Voices ---')
  try {
    const res = await fetch('https://api.inworld.ai/tts/v1/voices', {
      headers: {
        'Authorization': `Basic ${INWORLD_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    if (res.ok) {
      const data = await res.json() as { voices?: Array<{ voiceId: string; displayName: string }> }
      const voices = data.voices || []
      console.log('Available voices:', voices.map(v => v.voiceId).join(', '))
      console.log(`Total: ${voices.length} voices`)
      console.log('PASS: Voice list retrieved')
    } else {
      console.log('Status:', res.status)
      const errText = await res.text()
      console.log('Error:', errText.substring(0, 300))
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

main().catch(console.error)
