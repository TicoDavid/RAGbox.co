/**
 * Document Privilege API - RAGbox.co
 *
 * PATCH /api/documents/{id}/privilege — Update privilege settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { writeAuditEntry } from '@/lib/audit/auditWriter'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  const { id } = await params

  let body: { privilegeLevel?: string; isRestricted?: boolean; accessList?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate privilege level
  const validLevels = ['standard', 'confidential', 'privileged']
  if (body.privilegeLevel && !validLevels.includes(body.privilegeLevel)) {
    return NextResponse.json(
      { success: false, error: `Invalid privilegeLevel. Must be: ${validLevels.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    // Verify document exists and belongs to user
    const doc = await prisma.document.findFirst({
      where: { id, userId },
      select: { id: true, privilegeLevel: true, isRestricted: true },
    })

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    const oldLevel = doc.privilegeLevel

    if (body.privilegeLevel !== undefined) {
      updateData.privilegeLevel = body.privilegeLevel
      updateData.isPrivileged = body.privilegeLevel === 'privileged'

      // Auto-restrict when setting to privileged
      if (body.privilegeLevel === 'privileged') {
        updateData.isRestricted = true
        updateData.classifiedAt = new Date()
        updateData.classifiedBy = userId
      }

      // Clear restrictions when setting to standard
      if (body.privilegeLevel === 'standard') {
        updateData.isRestricted = false
        updateData.accessList = []
      }
    }

    if (body.isRestricted !== undefined) {
      updateData.isRestricted = body.isRestricted
    }

    if (body.accessList !== undefined) {
      updateData.accessList = body.accessList
    }

    const updated = await prisma.document.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        privilegeLevel: true,
        isRestricted: true,
        accessList: true,
        classifiedAt: true,
        classifiedBy: true,
      },
    })

    // Write audit entry (best-effort — don't crash if audit fails)
    try {
      await writeAuditEntry(userId, 'document.classify', id, {
        oldLevel,
        newLevel: updated.privilegeLevel,
        isRestricted: updated.isRestricted,
        accessListCount: updated.accessList.length,
      })
    } catch (auditErr) {
      console.error('[Privilege] Audit write failed:', auditErr)
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[Document Privilege] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update privilege' })
  }
}
