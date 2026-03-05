/**
 * User Profile API
 *
 * GET   /api/user/profile — Return current user profile
 * PUT   /api/user/profile — Update display name (avatar upload is P2)
 * PATCH /api/user/profile — Update work profile fields (company, job title, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  // Use raw SQL — isAdmin field may not be in generated Prisma client yet
  const users = await prisma.$queryRawUnsafe<Array<{
    id: string; name: string | null; email: string; image: string | null; role: string; is_admin: boolean; subscription_tier: string | null;
    company_name: string | null; job_title: string | null; industry: string | null; company_size: string | null; use_case: string | null
  }>>(
    `SELECT id, name, email, image, role, is_admin, subscription_tier, company_name, job_title, industry, company_size, use_case FROM users WHERE id = $1 LIMIT 1`,
    userId
  )

  if (users.length === 0) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }

  const user = users[0]

  return NextResponse.json({
    success: true,
    data: {
      displayName: user.name,
      email: user.email,
      avatarUrl: user.image,
      role: user.role,
      isAdmin: user.is_admin === true,
      subscriptionTier: user.subscription_tier || null,
      companyName: user.company_name || null,
      jobTitle: user.job_title || null,
      industry: user.industry || null,
      companySize: user.company_size || null,
      useCase: user.use_case || null,
    },
  })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  let body: { displayName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.displayName || typeof body.displayName !== 'string') {
    return NextResponse.json({ success: false, error: 'displayName is required' }, { status: 400 })
  }

  const trimmed = body.displayName.trim()

  if (trimmed.length === 0) {
    return NextResponse.json({ success: false, error: 'displayName cannot be empty' }, { status: 400 })
  }

  if (trimmed.length > 100) {
    return NextResponse.json({ success: false, error: 'displayName must be 100 characters or less' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name: trimmed },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      displayName: updated.name,
      email: updated.email,
      avatarUrl: updated.image,
      role: updated.role,
    },
  })
}

const ALLOWED_INDUSTRIES = [
  'Legal', 'Finance', 'Healthcare', 'Technology', 'Government',
  'Education', 'Consulting', 'Real Estate', 'Insurance', 'Manufacturing', 'Other',
] as const

const ALLOWED_COMPANY_SIZES = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+',
] as const

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
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

  // Build SET clauses and params for raw SQL update
  const setClauses: string[] = []
  const params: (string | null)[] = []
  let paramIndex = 1

  if ('companyName' in body) {
    const val = typeof body.companyName === 'string' ? body.companyName.trim().slice(0, 200) : null
    setClauses.push(`company_name = $${paramIndex++}`)
    params.push(val || null)
  }

  if ('jobTitle' in body) {
    const val = typeof body.jobTitle === 'string' ? body.jobTitle.trim().slice(0, 100) : null
    setClauses.push(`job_title = $${paramIndex++}`)
    params.push(val || null)
  }

  if ('industry' in body) {
    const val = typeof body.industry === 'string' ? body.industry : null
    if (val && !ALLOWED_INDUSTRIES.includes(val as typeof ALLOWED_INDUSTRIES[number])) {
      return NextResponse.json({ success: false, error: `Invalid industry` }, { status: 400 })
    }
    setClauses.push(`industry = $${paramIndex++}`)
    params.push(val || null)
  }

  if ('companySize' in body) {
    const val = typeof body.companySize === 'string' ? body.companySize : null
    if (val && !ALLOWED_COMPANY_SIZES.includes(val as typeof ALLOWED_COMPANY_SIZES[number])) {
      return NextResponse.json({ success: false, error: `Invalid company size` }, { status: 400 })
    }
    setClauses.push(`company_size = $${paramIndex++}`)
    params.push(val || null)
  }

  if ('useCase' in body) {
    const val = typeof body.useCase === 'string' ? body.useCase.trim().slice(0, 500) : null
    setClauses.push(`use_case = $${paramIndex++}`)
    params.push(val || null)
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
  }

  params.push(userId)
  const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING company_name, job_title, industry, company_size, use_case`

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      company_name: string | null; job_title: string | null; industry: string | null; company_size: string | null; use_case: string | null
    }>>(sql, ...params)

    const row = rows[0]
    return NextResponse.json({
      success: true,
      data: {
        companyName: row?.company_name || null,
        jobTitle: row?.job_title || null,
        industry: row?.industry || null,
        companySize: row?.company_size || null,
        useCase: row?.use_case || null,
      },
    })
  } catch (err) {
    console.error('[profile/PATCH] Error:', err)
    return NextResponse.json({ success: false, error: 'Failed to update work profile' }, { status: 500 })
  }
}
