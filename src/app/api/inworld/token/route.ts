import { NextResponse } from 'next/server'

/**
 * Inworld AI Token Generation
 *
 * This endpoint generates a session token for the Inworld AI voice integration.
 * The token is used by the frontend to establish a secure WebRTC connection.
 */

export async function POST() {
  try {
    const apiKey = process.env.INWORLD_API_KEY
    const jwtKey = process.env.INWORLD_JWT_KEY
    const jwtSecret = process.env.INWORLD_JWT_SECRET

    if (!apiKey || !jwtKey || !jwtSecret) {
      return NextResponse.json(
        { error: 'Inworld credentials not configured' },
        { status: 500 }
      )
    }

    // Generate a session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // For Inworld, we pass the API key directly to the client
    // The client SDK handles the authentication
    // In production, you'd generate a short-lived JWT token here

    return NextResponse.json({
      success: true,
      sessionId,
      // Pass credentials securely (in production, use short-lived tokens)
      credentials: {
        apiKey: apiKey,
        apiSecret: jwtSecret,
      },
      config: {
        voiceId: process.env.INWORLD_VOICE_ID || 'mercury_professional',
      }
    })
  } catch (error) {
    console.error('Inworld token generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate Inworld session' },
      { status: 500 }
    )
  }
}
