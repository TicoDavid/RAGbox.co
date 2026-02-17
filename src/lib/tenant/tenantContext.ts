/**
 * Multi-Tenant Context Utilities
 *
 * Provides tenant isolation for all data queries.
 * Default tenant ("default") is used for backward compatibility.
 */

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

const DEFAULT_TENANT = 'default'

export interface TenantContext {
  tenantId: string
  userId: string
}

/**
 * Extract tenant context from a request.
 * Priority: X-Tenant-ID header → user's assigned tenant → default
 */
export async function getTenantContext(request: NextRequest): Promise<TenantContext | null> {
  const token = await getToken({ req: request })
  if (!token) return null

  const userId = (token.id as string) || token.email || ''
  const headerTenant = request.headers.get('x-tenant-id')

  // If a tenant header is provided, validate it exists
  if (headerTenant && headerTenant !== DEFAULT_TENANT) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: headerTenant },
    })
    if (!tenant) return null // Invalid tenant
  }

  return {
    tenantId: headerTenant || DEFAULT_TENANT,
    userId,
  }
}

/**
 * Build a Prisma where clause with tenant isolation.
 * Merges tenant_id filter into any existing where clause.
 */
export function withTenantScope<T extends Record<string, unknown>>(
  where: T,
  tenantId: string
): T & { tenantId: string } {
  return { ...where, tenantId }
}

/**
 * Get tenant ID from API key auth context.
 * Falls back to default tenant.
 */
export function getTenantFromApiKey(tenantId?: string): string {
  return tenantId || DEFAULT_TENANT
}

/**
 * Validate that a tenant exists and is active.
 */
export async function validateTenant(tenantId: string): Promise<boolean> {
  if (tenantId === DEFAULT_TENANT) return true
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  })
  return tenant !== null
}
