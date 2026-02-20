/**
 * Folder Detail API — RAGbox.co
 *
 * PATCH  /api/documents/folders/[id] — Rename folder
 * DELETE /api/documents/folders/[id] — Delete folder (moves contents to root)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

async function authenticate(request: NextRequest) {
  const token = await getToken({ req: request })
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

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ success: false, error: 'Folder name is required' }, { status: 400 })
  }

  if (name.length > 255) {
    return NextResponse.json({ success: false, error: 'Folder name must be 255 characters or fewer' }, { status: 400 })
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
      data: { name },
      select: {
        id: true,
        name: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ success: true, data: { folder: updated } })
  } catch (error) {
    console.error('[Folders PATCH] Error:', error)
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
    console.error('[Folders DELETE] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete folder' }, { status: 500 })
  }
}
