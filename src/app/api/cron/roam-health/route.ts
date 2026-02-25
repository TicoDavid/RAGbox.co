/**
 * ROAM Health Check Cron
 * GET /api/cron/roam-health — Ping connected ROAM integrations
 *
 * Called every 30 min by Cloud Scheduler. For each connected integration:
 *   1. Decrypt API key → listGroups ping
 *   2. On 401 → set status='error', write audit
 *   3. Check webhook subscription → auto-reconnect if dropped
 *   4. Update lastHealthCheckAt
 *
 * Auth: same pattern as gmail-watch-renew (CRON_SECRET / INTERNAL_AUTH_SECRET)
 *
 * STORY-104 — EPIC-010
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { listGroupsWithKey, RoamApiError } from '@/lib/roam/roamClient'
import { checkWebhookSubscription, ensureWebhookSubscription } from '@/lib/roam/roamWebhook'
import { decryptKey } from '@/lib/utils/kms'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Read secrets per-request to avoid stale module-scope values
  const cronSecret = (process.env.CRON_SECRET || '').trim()
  const internalAuthSecret = (process.env.INTERNAL_AUTH_SECRET || '').trim()

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
  let checked = 0
  let errored = 0
  let reconnected = 0

  try {
    const integrations = await prisma.roamIntegration.findMany({
      where: { status: 'connected' },
    })

    logger.info(`[ROAM Health] Checking ${integrations.length} connected integrations`)

    for (const integration of integrations) {
      try {
        if (!integration.apiKeyEncrypted) {
          errors.push(`${integration.tenantId}: no encrypted key`)
          continue
        }

        const apiKey = await decryptKey(integration.apiKeyEncrypted)

        // 1. Ping ROAM API with listGroups
        try {
          await listGroupsWithKey(apiKey)
        } catch (error) {
          if (error instanceof RoamApiError && error.status === 401) {
            // Key revoked — set to error state
            await prisma.roamIntegration.update({
              where: { id: integration.id },
              data: {
                status: 'error',
                errorReason: 'API key revoked or invalid (401 on health check)',
                lastHealthCheckAt: new Date(),
              },
            })

            await prisma.mercuryAction.create({
              data: {
                userId: integration.userId,
                actionType: 'roam_key_revoked',
                status: 'completed',
                metadata: {
                  channel: 'roam',
                  tenantId: integration.tenantId,
                  reason: 'Health check returned 401',
                } as Prisma.InputJsonValue,
              },
            })

            errored++
            errors.push(`${integration.tenantId}: 401 — key revoked`)
            continue
          }
          // Other errors — log but don't mark as error (could be transient)
          throw error
        }

        // 2. Check webhook subscription
        if (integration.webhookSubscriptionId) {
          const sub = await checkWebhookSubscription(apiKey, integration.webhookSubscriptionId)
          if (!sub) {
            // Webhook dropped — auto-reconnect
            logger.info(`[ROAM Health] Webhook dropped for tenant ${integration.tenantId} — reconnecting`)
            try {
              const newSub = await ensureWebhookSubscription(apiKey)
              await prisma.roamIntegration.update({
                where: { id: integration.id },
                data: { webhookSubscriptionId: newSub.id },
              })
              reconnected++
              logger.info(`[ROAM Health] Webhook reconnected: ${newSub.id}`)
            } catch (webhookError) {
              const msg = webhookError instanceof Error ? webhookError.message : 'unknown'
              errors.push(`${integration.tenantId}: webhook reconnect failed — ${msg}`)
            }
          }
        }

        // 3. Update health check timestamp
        await prisma.roamIntegration.update({
          where: { id: integration.id },
          data: {
            lastHealthCheckAt: new Date(),
            errorReason: null, // Clear any previous transient error
          },
        })

        checked++
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'unknown error'
        errors.push(`${integration.tenantId}: ${msg}`)
        logger.error(`[ROAM Health] Check failed for tenant ${integration.tenantId}:`, error)
      }
    }

    return NextResponse.json({
      checked,
      errored,
      reconnected,
      total: integrations.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    logger.error('[ROAM Health] Fatal error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Health check failed', checked, errored, errors },
      { status: 500 },
    )
  }
}
