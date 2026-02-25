/**
 * Folder CRUD API — RAGbox.co
 *
 * GET  /api/documents/folders — List folders as tree (scoped to user)
 * POST /api/documents/folders — Create a new folder
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
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
        createdAt: true,
        updatedAt: true,
        _count: { select: { documents: true, children: true } },
      },
    })

    // Build tree structure: top-level folders with nested children
    const folderMap = new Map<string, typeof folders[number] & { children: unknown[] }>()
    const tree: Array<typeof folders[number] & { children: unknown[] }> = []

    for (const f of folders) {
      folderMap.set(f.id, { ...f, children: [] })
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
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  let body: { name?: string; parentId?: string | null }
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
    // If parentId provided, verify it belongs to this user
    if (body.parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: body.parentId, userId },
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
        parentId: body.parentId ?? null,
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
