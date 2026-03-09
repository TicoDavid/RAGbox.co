/**
 * Folder Detail API — RAGbox.co
 *
 * PATCH  /api/documents/folders/[id] — Rename folder
 * DELETE /api/documents/folders/[id] — Delete folder (moves contents to root)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

const folderPatchSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  color: z.enum(['blue', 'green', 'amber', 'red', 'purple', 'grey']).nullable().optional(),
}).refine(data => data.name !== undefined || data.color !== undefined, {
  message: 'name or color is required',
})

type RouteContext = { params: Promise<{ id: string }> }

async function authenticate(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return null
  const userId = (token.id as string) || token.email || ''
  return userId || null
}

export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const userId = await authenticate(request)
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = folderPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}

  if (parsed.data.name !== undefined) {
    updateData.name = parsed.data.name
  }

  if (parsed.data.color !== undefined) {
    updateData.color = parsed.data.color
  }

  try {
    // Verify folder exists and belongs to user
    const folder = await prisma.folder.findFirst({
      where: { id, userId },
      select: { id: true },
    })

    if (!folder) {
      return NextResponse.json({ success: false, error: 'Folder not found' }, { status: 404 })
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: updateData,
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
    logger.error('[Folders PATCH] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to rename folder' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const userId = await authenticate(request)
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await params

  try {
    // Verify folder exists and belongs to user
    const folder = await prisma.folder.findFirst({
      where: { id, userId },
      select: { id: true, name: true },
    })

    if (!folder) {
      return NextResponse.json({ success: false, error: 'Folder not found' }, { status: 404 })
    }

    // Move all documents in this folder to root (folderId = null)
    const movedDocs = await prisma.document.updateMany({
      where: { folderId: id, userId },
      data: { folderId: null, sortOrder: 0 },
    })

    // Move all child folders to root (parentId = null)
    const movedFolders = await prisma.folder.updateMany({
      where: { parentId: id, userId },
      data: { parentId: null },
    })

    // Delete the folder itself
    await prisma.folder.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      data: {
        deleted: id,
        deletedName: folder.name,
        movedDocuments: movedDocs.count,
        movedFolders: movedFolders.count,
      },
    })
  } catch (error) {
    logger.error('[Folders DELETE] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete folder' }, { status: 500 })
  }
}
