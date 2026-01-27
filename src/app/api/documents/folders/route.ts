/**
 * Folders API - RAGbox.co
 *
 * GET /api/documents/folders - List folders
 * POST /api/documents/folders - Create folder
 * PATCH /api/documents/folders - Rename folder
 * DELETE /api/documents/folders - Delete folder
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'

async function getUserId(): Promise<string> {
  const sessionCookie = (await cookies()).get('session')
  return sessionCookie?.value || 'demo_user'
}

export async function GET() {
  try {
    const userId = await getUserId()

    const folders = await prisma.folder.findMany({
      where: { userId },
      include: {
        _count: { select: { documents: true } },
        children: {
          include: {
            _count: { select: { documents: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const mapped = folders.map(f => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      documentCount: f._count.documents,
      children: f.children.map(c => ({
        id: c.id,
        name: c.name,
        parentId: c.parentId,
        documentCount: c._count.documents,
        children: [],
      })),
    }))

    return NextResponse.json({ folders: mapped })
  } catch (error) {
    console.error('[Folders API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId()
    const { name, parentId } = await request.json()

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 })
    }

    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        userId,
        parentId: parentId || null,
      },
    })

    return NextResponse.json({ folder }, { status: 201 })
  } catch (error) {
    console.error('[Folders API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId()
    const { id, name } = await request.json()

    if (!id || !name) {
      return NextResponse.json({ error: 'id and name are required' }, { status: 400 })
    }

    const existing = await prisma.folder.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    const folder = await prisma.folder.update({
      where: { id },
      data: { name: name.trim() },
    })

    return NextResponse.json({ folder })
  } catch (error) {
    console.error('[Folders API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 })
    }

    const existing = await prisma.folder.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Move documents out of folder before deleting
    await prisma.document.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    })

    // Delete child folders
    await prisma.folder.deleteMany({
      where: { parentId: id },
    })

    await prisma.folder.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Folders API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
