/**
 * Gmail Watch Setup
 * POST /api/gmail/watch — Enable Gmail push notifications for an agent
 *
 * Sets up Gmail API watch on the agent's inbox. Gmail will push notifications
 * to the Pub/Sub topic which forwards to /api/gmail/webhook.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/gmail/token'

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'ragbox-sovereign-prod'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth: session OR internal auth (for cron)
  const internalAuth = request.headers.get('x-internal-auth') || ''
  const session = await getServerSession(authOptions)

  if (!session && (!INTERNAL_AUTH_SECRET || internalAuth !== INTERNAL_AUTH_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { agentId } = (await request.json()) as { agentId: string }

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    const accessToken = await getValidAccessToken(agentId)

    // Call Gmail watch API
    const watchResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/watch',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicName: `projects/${GCP_PROJECT}/topics/gmail-push-notifications`,
          labelIds: ['INBOX'],
        }),
      }
    )

    if (!watchResponse.ok) {
      const errData = await watchResponse.json().catch(() => ({}))
      console.error('[Gmail Watch] Setup failed:', errData)
      return NextResponse.json(
        { error: 'Gmail watch setup failed', details: errData },
        { status: 502 }
      )
    }

    const watchData = (await watchResponse.json()) as {
      historyId: string
      expiration: string
    }

    // Update credential with watch info
    await prisma.agentEmailCredential.update({
      where: { agentId },
      data: {
        watchExpires: new Date(parseInt(watchData.expiration)),
        lastHistoryId: watchData.historyId,
      },
    })

    return NextResponse.json({
      success: true,
      watchExpires: new Date(parseInt(watchData.expiration)).toISOString(),
      historyId: watchData.historyId,
    })
  } catch (error) {
    console.error('[Gmail Watch] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Watch setup failed' },
      { status: 500 }
    )
  }
}
