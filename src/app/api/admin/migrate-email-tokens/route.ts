/**
 * Email Token KMS Migration — S-P0-01
 *
 * POST /api/admin/migrate-email-tokens
 *
 * Batch re-encrypts email refresh tokens from legacy aes: (NEXTAUTH_SECRET)
 * to kms-email: (Cloud KMS). Idempotent — skips already-migrated tokens.
 *
 * Admin-only endpoint. Requires X-Admin-Secret header.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decryptToken, encryptToken, isEncrypted } from '@/lib/gmail/crypto'
import { logger } from '@/lib/logger'

const ADMIN_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const LEGACY_PREFIX = 'aes:'
const KMS_PREFIX = 'kms-email:'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth: admin only
  const authHeader = request.headers.get('x-admin-secret') || request.headers.get('x-internal-auth')
  if (!ADMIN_SECRET || authHeader !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find all credentials with legacy encryption
    const credentials = await prisma.agentEmailCredential.findMany({
      select: { id: true, agentId: true, refreshToken: true },
    })

    let migrated = 0
    let skipped = 0
    let failed = 0
    const errors: Array<{ id: string; error: string }> = []

    for (const cred of credentials) {
      // Skip if already on KMS
      if (cred.refreshToken.startsWith(KMS_PREFIX)) {
        skipped++
        continue
      }

      // Skip if not encrypted at all (shouldn't happen, but defensive)
      if (!isEncrypted(cred.refreshToken)) {
        // Encrypt plaintext token with KMS
        try {
          const encrypted = await encryptToken(cred.refreshToken)
          await prisma.agentEmailCredential.update({
            where: { id: cred.id },
            data: { refreshToken: encrypted },
          })
          migrated++
        } catch (err) {
          failed++
          errors.push({ id: cred.id, error: err instanceof Error ? err.message : 'Unknown' })
        }
        continue
      }

      // Migrate from aes: → kms-email:
      if (cred.refreshToken.startsWith(LEGACY_PREFIX)) {
        try {
          const plaintext = await decryptToken(cred.refreshToken)
          const reEncrypted = await encryptToken(plaintext)
          await prisma.agentEmailCredential.update({
            where: { id: cred.id },
            data: { refreshToken: reEncrypted },
          })
          migrated++
        } catch (err) {
          failed++
          errors.push({ id: cred.id, error: err instanceof Error ? err.message : 'Unknown' })
        }
        continue
      }

      skipped++
    }

    logger.info('[KMS Migration] Complete', { total: credentials.length, migrated, skipped, failed })

    return NextResponse.json({
      success: true,
      data: {
        total: credentials.length,
        migrated,
        skipped,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      },
    })
  } catch (error) {
    logger.error('[KMS Migration] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Migration failed' },
      { status: 500 }
    )
  }
}
