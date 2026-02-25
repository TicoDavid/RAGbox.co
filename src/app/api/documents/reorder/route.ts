/**
 * Document Reorder API — RAGbox.co
 *
 * POST /api/documents/reorder — Batch update sortOrder for drag-and-drop
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

interface ReorderItem {
  id: string
  sortOrder: number
  folderId?: string | null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  let body: { items?: ReorderItem[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const items = body.items
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ success: false, error: 'items array is required' }, { status: 400 })
  }

  if (items.length > 500) {
    return NextResponse.json({ success: false, error: 'Too many items (max 500)' }, { status: 400 })
  }

  // Validate each item has required fields
  for (const item of items) {
    if (!item.id || typeof item.sortOrder !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Each item must have id (string) and sortOrder (number)' },
        { status: 400 }
      )
    }
  }

  try {
    // Verify all documents belong to this user
    const docIds = items.map((item) => item.id)
    const docs = await prisma.document.findMany({
      where: { id: { in: docIds }, userId },
      select: { id: true },
    })

    const ownedIds = new Set(docs.map((d) => d.id))
    const unauthorized = docIds.filter((id) => !ownedIds.has(id))
    if (unauthorized.length > 0) {
      return NextResponse.json(
        { success: false, error: `Documents not found: ${unauthorized.slice(0, 5).join(', ')}` },
        { status: 404 }
      )
    }

    // If any items reference a folderId, verify those folders belong to user
    const folderIds = [...new Set(
      items.filter((item) => item.folderId).map((item) => item.folderId!)
    )]

    if (folderIds.length > 0) {
      const folders = await prisma.folder.findMany({
        where: { id: { in: folderIds }, userId },
        select: { id: true },
      })
      const ownedFolderIds = new Set(folders.map((f) => f.id))
      const badFolders = folderIds.filter((fid) => !ownedFolderIds.has(fid))
      if (badFolders.length > 0) {
        return NextResponse.json(
          { success: false, error: `Folders not found: ${badFolders.slice(0, 5).join(', ')}` },
          { status: 404 }
        )
      }
    }

    // Batch update using transaction
    await prisma.$transaction(
      items.map((item) => {
        const data: { sortOrder: number; folderId?: string | null } = {
          sortOrder: item.sortOrder,
        }
        if (item.folderId !== undefined) {
          data.folderId = item.folderId
        }
        return prisma.document.update({
          where: { id: item.id },
          data,
        })
      })
    )

    return NextResponse.json({
      success: true,
      data: { updated: items.length },
    })
  } catch (error) {
    logger.error('[Document Reorder] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to reorder documents' }, { status: 500 })
  }
}
