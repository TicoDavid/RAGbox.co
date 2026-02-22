/**
 * ROAM Dead Letter Queue Admin
 *
 * GET  /api/admin/roam/dead-letters — List dead letters (paginated, filterable)
 * POST /api/admin/roam/dead-letters — Replay a specific dead letter by ID
 *
 * Auth: x-internal-auth header with INTERNAL_AUTH_SECRET
 *
 * STORY-104 — EPIC-010
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const PROCESS_EVENT_URL = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ragbox.co'}/api/roam/process-event`

function authorize(request: NextRequest): boolean {
  const authHeader = request.headers.get('x-internal-auth') || ''
  return !!(INTERNAL_AUTH_SECRET && authHeader === INTERNAL_AUTH_SECRET)
}

/**
 * GET — List dead letters with pagination and optional filters.
 * Query params: page, limit, tenantId, retried, eventType
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)))
  const tenantId = url.searchParams.get('tenantId')
  const retriedParam = url.searchParams.get('retried')
  const eventType = url.searchParams.get('eventType')

  const where: Prisma.RoamDeadLetterWhereInput = {}
  if (tenantId) where.tenantId = tenantId
  if (retriedParam !== null && retriedParam !== undefined && retriedParam !== '') {
    where.retried = retriedParam === 'true'
  }
  if (eventType) where.eventType = eventType

  try {
    const [items, total] = await Promise.all([
      prisma.roamDeadLetter.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.roamDeadLetter.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list dead letters',
    }, { status: 500 })
  }
}

/**
 * POST — Replay a dead letter by ID.
 * Body: { id: string }
 *
 * Re-posts the original event payload to the process-event endpoint
 * as a Pub/Sub push message, then marks the dead letter as retried.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'Missing dead letter id' }, { status: 400 })
  }

  try {
    const deadLetter = await prisma.roamDeadLetter.findUnique({
      where: { id: body.id },
    })

    if (!deadLetter) {
      return NextResponse.json({ error: 'Dead letter not found' }, { status: 404 })
    }

    if (deadLetter.retried) {
      return NextResponse.json({ error: 'Already retried' }, { status: 409 })
    }

    // Re-encode the original payload as a Pub/Sub push message
    const encodedData = Buffer.from(JSON.stringify(deadLetter.payload)).toString('base64')

    const replayResponse = await fetch(PROCESS_EVENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          data: encodedData,
          messageId: `replay-${deadLetter.id}`,
        },
        subscription: 'replay',
      }),
      signal: AbortSignal.timeout(30000),
    })

    // Mark as retried regardless of outcome
    await prisma.roamDeadLetter.update({
      where: { id: deadLetter.id },
      data: {
        retried: true,
        retriedAt: new Date(),
      },
    })

    // Audit trail
    await prisma.mercuryAction.create({
      data: {
        userId: 'system',
        actionType: 'roam_dlq_replay',
        status: replayResponse.ok ? 'completed' : 'failed',
        metadata: {
          deadLetterId: deadLetter.id,
          pubsubMessageId: deadLetter.pubsubMessageId,
          replayStatus: replayResponse.status,
        } as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({
      success: true,
      replayed: true,
      replayStatus: replayResponse.status,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Replay failed',
    }, { status: 500 })
  }
}
