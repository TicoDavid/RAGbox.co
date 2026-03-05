/**
 * GET /api/admin/audit-vault
 *
 * Temporary diagnostic endpoint — audits David's vault data post-purge.
 * Protected by INTERNAL_AUTH_SECRET header.
 * Returns document/chunk/message counts for David's userId.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = request.headers.get('x-internal-auth')
  if (!secret || secret !== process.env.INTERNAL_AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, unknown> = {}

  // 1. Find David's user record
  const users = await prisma.$queryRawUnsafe<Array<{
    id: string; email: string; createdAt: Date
  }>>(
    `SELECT id, email, "createdAt" FROM users WHERE email = 'd05279090@gmail.com' LIMIT 1`
  )

  if (users.length === 0) {
    return NextResponse.json({ error: 'User d05279090@gmail.com not found in users table' })
  }

  const user = users[0]
  results.user = { id: user.id, email: user.email, createdAt: user.createdAt }

  const userId = user.id

  // 2. Count documents
  const docCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM documents WHERE "userId" = $1`, userId
  )
  results.documentCount = Number(docCount[0]?.count ?? 0)

  // 3. Count chunks (via documents)
  const chunkCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM document_chunks dc
     JOIN documents d ON dc."documentId" = d.id
     WHERE d."userId" = $1`, userId
  )
  results.chunkCount = Number(chunkCount[0]?.count ?? 0)

  // 4. Count messages (mercury threads)
  const msgCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM mercury_messages mm
     JOIN mercury_threads mt ON mm."threadId" = mt.id
     WHERE mt."userId" = $1`, userId
  )
  results.messageCount = Number(msgCount[0]?.count ?? 0)

  // 5. List documents with status
  const docs = await prisma.$queryRawUnsafe<Array<{
    id: string; originalName: string; indexStatus: string; createdAt: Date; fileSize: number | null
  }>>(
    `SELECT id, "originalName", "indexStatus", "createdAt", "fileSize"
     FROM documents WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 50`, userId
  )
  results.documents = docs

  // 6. Also check the SAFE userId from Sarah's purge log
  const safeUserId = '105836695160618550214'
  const safeDocCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM documents WHERE "userId" = $1`, safeUserId
  )
  results.safeUserIdDocCount = Number(safeDocCount[0]?.count ?? 0)
  results.safeUserId = safeUserId

  // 7. Check if the two userIds are the same account
  const safeUser = await prisma.$queryRawUnsafe<Array<{ id: string; email: string }>>(
    `SELECT id, email FROM users WHERE id = $1 LIMIT 1`, safeUserId
  )
  results.safeUserRecord = safeUser.length > 0 ? safeUser[0] : null

  return NextResponse.json({ success: true, audit: results })
}
