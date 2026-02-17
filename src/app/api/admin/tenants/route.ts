/**
 * Tenant Management API (Admin Only)
 *
 * GET  /api/admin/tenants — List all tenants
 * POST /api/admin/tenants — Create a new tenant
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

async function requireAdmin(request: NextRequest) {
  const token = await getToken({ req: request })
  if (!token) return null

  const userId = (token.id as string) || token.email || ''
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user || user.role !== 'Partner') return null
  return userId
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const adminId = await requireAdmin(request)
  if (!adminId) {
    return NextResponse.json(
      { success: false, error: 'Admin access required (Partner role)' },
      { status: 403 }
    )
  }

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: { tenants } })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminId = await requireAdmin(request)
  if (!adminId) {
    return NextResponse.json(
      { success: false, error: 'Admin access required (Partner role)' },
      { status: 403 }
    )
  }

  let body: { name?: string; slug?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ success: false, error: 'Tenant name is required' }, { status: 400 })
  }

  const slug = (body.slug || body.name).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')

  const existing = await prisma.tenant.findUnique({ where: { slug } })
  if (existing) {
    return NextResponse.json(
      { success: false, error: 'Tenant slug already exists' },
      { status: 409 }
    )
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: body.name.trim(),
      slug,
    },
  })

  return NextResponse.json({ success: true, data: { tenant } }, { status: 201 })
}
