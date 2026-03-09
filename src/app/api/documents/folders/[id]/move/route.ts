/**
 * Folder Move API — RAGbox.co (EPIC-032)
 *
 * POST /api/documents/folders/[id]/move — Move folder to a new parent
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

const folderMoveSchema = z.object({
  parentId: z.string().min(1).nullable(),
})

type RouteContext = { params: Promise<{ id: string }> }

async function checkIsDescendant(folderId: string, targetParentId: string, userId: string): Promise<boolean> {
  // Walk up from targetParentId — if we hit folderId, it's circular
  let current: string | null = targetParentId
  const visited = new Set<string>()

  while (current) {
    if (current === folderId) return true
    if (visited.has(current)) break
    visited.add(current)
    const found: { parentId: string | null } | null = await prisma.folder.findFirst({
      where: { id: current, userId },
      select: { parentId: true },
    })
    if (!found?.parentId) break
    current = found.parentId
  }

  return false
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = folderMoveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { parentId } = parsed.data

  try {
    // Verify folder ownership
    const folder = await prisma.folder.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!folder) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    // Prevent circular reference
    if (parentId) {
      // Verify target parent exists and belongs to user
      const targetParent = await prisma.folder.findFirst({
        where: { id: parentId, userId },
        select: { id: true },
      })
      if (!targetParent) {
        return NextResponse.json({ success: false, error: 'Target parent folder not found' }, { status: 404 })
      }

      const isDescendant = await checkIsDescendant(id, parentId, userId)
      if (isDescendant) {
        return NextResponse.json(
          { success: false, error: 'Cannot move folder into its own subfolder' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: { parentId: parentId || null },
      select: {
        id: true,
        name: true,
        parentId: true,
        color: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ success: true, data: { folder: updated } })
  } catch (error) {
    logger.error('[Folder Move] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to move folder' }, { status: 500 })
  }
}
