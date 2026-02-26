/**
 * Work Profile API
 *
 * GET  /api/user/work-profile — Return user's work profile fields
 * PUT  /api/user/work-profile — Update work profile (company, job title, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

const ALLOWED_INDUSTRIES = [
  'Legal',
  'Finance',
  'Healthcare',
  'Technology',
  'Government',
  'Education',
  'Consulting',
  'Real Estate',
  'Insurance',
  'Manufacturing',
  'Other',
] as const

const ALLOWED_COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5000+',
] as const

// BUG-039c: Safe default when work-profile columns don't exist in DB yet (P2022)
const EMPTY_PROFILE = {
  companyName: null,
  jobTitle: null,
  industry: null,
  companySize: null,
  useCase: null,
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        companyName: true,
        jobTitle: true,
        industry: true,
        companySize: true,
        useCase: true,
      },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error: unknown) {
    const prismaCode = (error as { code?: string })?.code
    if (prismaCode === 'P2022') {
      // Work-profile columns don't exist yet — return empty profile so frontend renders
      logger.warn('Work-profile GET: P2022 — columns missing, returning empty profile')
      return NextResponse.json({ success: true, data: EMPTY_PROFILE })
    }
    logger.error('Work-profile GET error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate fields
  const updates: Record<string, string | null> = {}

  if ('companyName' in body) {
    if (body.companyName !== null && typeof body.companyName !== 'string') {
      return NextResponse.json({ success: false, error: 'companyName must be a string' }, { status: 400 })
    }
    const val = typeof body.companyName === 'string' ? body.companyName.trim() : null
    if (val && val.length > 200) {
      return NextResponse.json({ success: false, error: 'companyName must be 200 characters or less' }, { status: 400 })
    }
    updates.companyName = val || null
  }

  if ('jobTitle' in body) {
    if (body.jobTitle !== null && typeof body.jobTitle !== 'string') {
      return NextResponse.json({ success: false, error: 'jobTitle must be a string' }, { status: 400 })
    }
    const val = typeof body.jobTitle === 'string' ? body.jobTitle.trim() : null
    if (val && val.length > 100) {
      return NextResponse.json({ success: false, error: 'jobTitle must be 100 characters or less' }, { status: 400 })
    }
    updates.jobTitle = val || null
  }

  if ('industry' in body) {
    if (body.industry !== null && typeof body.industry !== 'string') {
      return NextResponse.json({ success: false, error: 'industry must be a string' }, { status: 400 })
    }
    if (body.industry !== null && !ALLOWED_INDUSTRIES.includes(body.industry as typeof ALLOWED_INDUSTRIES[number])) {
      return NextResponse.json({ success: false, error: `industry must be one of: ${ALLOWED_INDUSTRIES.join(', ')}` }, { status: 400 })
    }
    updates.industry = (body.industry as string) || null
  }

  if ('companySize' in body) {
    if (body.companySize !== null && typeof body.companySize !== 'string') {
      return NextResponse.json({ success: false, error: 'companySize must be a string' }, { status: 400 })
    }
    if (body.companySize !== null && !ALLOWED_COMPANY_SIZES.includes(body.companySize as typeof ALLOWED_COMPANY_SIZES[number])) {
      return NextResponse.json({ success: false, error: `companySize must be one of: ${ALLOWED_COMPANY_SIZES.join(', ')}` }, { status: 400 })
    }
    updates.companySize = (body.companySize as string) || null
  }

  if ('useCase' in body) {
    if (body.useCase !== null && typeof body.useCase !== 'string') {
      return NextResponse.json({ success: false, error: 'useCase must be a string' }, { status: 400 })
    }
    const val = typeof body.useCase === 'string' ? body.useCase.trim() : null
    if (val && val.length > 500) {
      return NextResponse.json({ success: false, error: 'useCase must be 500 characters or less' }, { status: 400 })
    }
    updates.useCase = val || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        companyName: true,
        jobTitle: true,
        industry: true,
        companySize: true,
        useCase: true,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: unknown) {
    const prismaCode = (error as { code?: string })?.code
    if (prismaCode === 'P2022') {
      // Work-profile columns don't exist yet — acknowledge but can't persist
      logger.warn('Work-profile PUT: P2022 — columns missing, cannot persist update')
      return NextResponse.json({
        success: false,
        error: 'Profile fields are not yet available. Please try again after the next deployment.',
      }, { status: 503 })
    }
    logger.error('Work-profile PUT error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
