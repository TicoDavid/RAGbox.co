/**
 * Gmail Watch Renewal Cron
 * GET /api/cron/gmail-watch-renew — Renew expiring Gmail push notification watches
 *
 * Called daily by Cloud Scheduler. Finds credentials with watches expiring
 * within 24 hours and renews them via the Gmail watch API.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/gmail/token'

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'ragbox-sovereign-prod'

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Read secrets per-request to avoid stale module-scope values
  const cronSecret = (process.env.CRON_SECRET || '').trim()
  const internalAuthSecret = (process.env.INTERNAL_AUTH_SECRET || '').trim()

  // Auth: x-cron-secret header, Bearer token, OR x-internal-auth
  const cronHeader = (request.headers.get('x-cron-secret') || '').trim()
  const authHeader = request.headers.get('authorization') || ''
  const bearerToken = authHeader.replace('Bearer ', '').trim()
  const internalAuth = (request.headers.get('x-internal-auth') || '').trim()

  const cronValid = cronSecret && (cronHeader === cronSecret || bearerToken === cronSecret)
  const internalValid = internalAuthSecret && internalAuth === internalAuthSecret

  if (!cronValid && !internalValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const errors: string[] = []
  let renewed = 0

  try {
    // Find credentials with watches expiring within 24 hours
    const expiringCredentials = await prisma.agentEmailCredential.findMany({
      where: {
        isActive: true,
        watchExpires: {
          lt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
    })

    console.log(`[Gmail Watch Renew] Found ${expiringCredentials.length} expiring watches`)

    for (const credential of expiringCredentials) {
      try {
        const accessToken = await getValidAccessToken(credential.agentId)

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
          errors.push(`${credential.emailAddress}: ${JSON.stringify(errData)}`)
          continue
        }

        const watchData = (await watchResponse.json()) as {
          historyId: string
          expiration: string
        }

        await prisma.agentEmailCredential.update({
          where: { id: credential.id },
          data: {
            watchExpires: new Date(parseInt(watchData.expiration)),
            lastHistoryId: watchData.historyId,
          },
        })

        renewed++
        console.log(`[Gmail Watch Renew] Renewed: ${credential.emailAddress}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        errors.push(`${credential.emailAddress}: ${msg}`)
        console.error(`[Gmail Watch Renew] Failed: ${credential.emailAddress}:`, err)
      }
    }

    return NextResponse.json({ renewed, errors })
  } catch (error) {
    console.error('[Gmail Watch Renew] Fatal error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron failed', renewed, errors },
      { status: 500 }
    )
  }
}
