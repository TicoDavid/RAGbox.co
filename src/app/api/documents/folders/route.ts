/**
 * Folder CRUD API — RAGbox.co
 *
 * GET  /api/documents/folders — List folders as tree (scoped to user)
 * POST /api/documents/folders — Create a new folder
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

const folderCreateSchema = z.object({
  name: z.string().trim().min(1, 'Folder name is required').max(255, 'Folder name must be 255 characters or fewer'),
  parentId: z.string().min(1).nullable().optional(),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  try {
    const folders = await prisma.folder.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        parentId: true,
        color: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { documents: true, children: true } },
      },
    })

    // Fetch per-folder document stats in a single aggregation query (EPIC-032)
    const folderStats = await prisma.document.groupBy({
      by: ['folderId'],
      where: {
        userId,
        deletionStatus: 'Active',
        folderId: { not: null },
      },
      _count: { id: true },
      _sum: { sizeBytes: true },
    })

    const statsMap = new Map(
      folderStats.map(s => [s.folderId, {
        documentCount: s._count.id,
        totalSizeBytes: s._sum.sizeBytes || 0,
      }])
    )

    // Build tree structure: top-level folders with nested children + metadata
    type FolderNode = typeof folders[number] & {
      children: unknown[]
      documentCount: number
      totalSizeBytes: number
      nestedFolderCount: number
    }

    const folderMap = new Map<string, FolderNode>()
    const tree: FolderNode[] = []

    for (const f of folders) {
      folderMap.set(f.id, {
        ...f,
        children: [],
        documentCount: statsMap.get(f.id)?.documentCount || 0,
        totalSizeBytes: statsMap.get(f.id)?.totalSizeBytes || 0,
        nestedFolderCount: folders.filter(child => child.parentId === f.id).length,
      })
    }

    for (const f of folders) {
      const node = folderMap.get(f.id)!
      if (f.parentId && folderMap.has(f.parentId)) {
        folderMap.get(f.parentId)!.children.push(node)
      } else {
        tree.push(node)
      }
    }

    return NextResponse.json({ success: true, data: { folders: tree } })
  } catch (error) {
    logger.error('[Folders GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to list folders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = folderCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, parentId } = parsed.data

  try {
    // If parentId provided, verify it belongs to this user
    if (parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: parentId, userId },
        select: { id: true },
      })
      if (!parent) {
        return NextResponse.json({ success: false, error: 'Parent folder not found' }, { status: 404 })
      }
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        userId,
        parentId: parentId ?? null,
      },
      select: {
        id: true,
        name: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ success: true, data: { folder } }, { status: 201 })
  } catch (error) {
    logger.error('[Folders POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create folder' }, { status: 500 })
  }
}
