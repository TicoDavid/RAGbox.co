/**
 * Documents API - RAGbox.co
 *
 * GET  /api/documents — List documents (Prisma direct, not proxied)
 * POST /api/documents — Proxy upload to Go backend
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { proxyToBackend } from '@/lib/backend-proxy'

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine user identity' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const folderId = searchParams.get('folderId') || undefined

    // Try Prisma first
    let documents: unknown[] = []
    try {
      const where: Record<string, unknown> = {
        userId,
        deletionStatus: 'Active',
      }

      if (folderId) {
        where.folderId = folderId
      }

      if (search) {
        where.OR = [
          { filename: { contains: search, mode: 'insensitive' } },
          { originalName: { contains: search, mode: 'insensitive' } },
        ]
      }

      documents = await prisma.document.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          filename: true,
          originalName: true,
          mimeType: true,
          fileType: true,
          sizeBytes: true,
          indexStatus: true,
          deletionStatus: true,
          isPrivileged: true,
          privilegeLevel: true,
          securityTier: true,
          checksum: true,
          folderId: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    } catch (prismaErr) {
      console.error('[Documents GET] Prisma failed, trying Go backend:', prismaErr)
    }

    // If Prisma returned nothing, fall back to Go backend
    if (documents.length === 0) {
      try {
        const backendResponse = await proxyToBackend(request, {
          backendPath: '/api/documents',
        })
        // If Go backend returned a Response, extract data
        if (backendResponse instanceof Response) {
          const cloned = backendResponse.clone()
          try {
            const json = await cloned.json()
            const backendDocs = json.data?.documents || json.data || json.documents || []
            if (Array.isArray(backendDocs) && backendDocs.length > 0) {
              return NextResponse.json({ success: true, data: { documents: backendDocs } })
            }
          } catch {
            // Go backend didn't return JSON — ignore
          }
        }
      } catch {
        console.error('[Documents GET] Go backend fallback also failed')
      }
    }

    return NextResponse.json({
      success: true,
      data: { documents },
    })
  } catch (error) {
    console.error('[Documents GET] Error:', error)
    return NextResponse.json({
      success: true,
      data: { documents: [] },
    })
  }
}

export async function POST(request: NextRequest) {
  return proxyToBackend(request)
}
