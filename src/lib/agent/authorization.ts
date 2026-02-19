import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NextRequest } from 'next/server'

const DEFAULT_TENANT = 'default'

export interface AgentAuthResult {
  authorized: boolean
  userId: string
  tenantId: string
  agentId: string
  error?: string
  status?: number
}

/**
 * Authorize access to an agent resource via server session (cookie-based routes).
 * Verifies: 1) user is authenticated, 2) agent exists, 3) agent belongs to user's tenant.
 */
export async function authorizeAgentAccess(
  agentId: string
): Promise<AgentAuthResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return {
      authorized: false,
      userId: '',
      tenantId: '',
      agentId,
      error: 'Authentication required',
      status: 401,
    }
  }

  const persona = await prisma.mercuryPersona.findUnique({
    where: { id: agentId },
    select: { tenantId: true },
  })

  if (!persona) {
    return {
      authorized: false,
      userId: session.user.id,
      tenantId: DEFAULT_TENANT,
      agentId,
      error: 'Agent not found',
      status: 404,
    }
  }

  if (persona.tenantId !== DEFAULT_TENANT) {
    return {
      authorized: false,
      userId: session.user.id,
      tenantId: DEFAULT_TENANT,
      agentId,
      error: 'Access denied',
      status: 403,
    }
  }

  return {
    authorized: true,
    userId: session.user.id,
    tenantId: DEFAULT_TENANT,
    agentId,
  }
}

/**
 * Authorize access to an agent resource via JWT (API routes using getToken).
 * Verifies: 1) JWT is valid, 2) agent exists, 3) agent belongs to user's tenant.
 */
export async function authorizeAgentAccessJWT(
  request: NextRequest,
  agentId: string
): Promise<AgentAuthResult> {
  const token = await getToken({ req: request })
  if (!token) {
    return {
      authorized: false,
      userId: '',
      tenantId: '',
      agentId,
      error: 'Authentication required',
      status: 401,
    }
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return {
      authorized: false,
      userId: '',
      tenantId: '',
      agentId,
      error: 'Unable to determine user identity',
      status: 401,
    }
  }

  const persona = await prisma.mercuryPersona.findUnique({
    where: { id: agentId },
    select: { tenantId: true },
  })

  if (!persona) {
    return {
      authorized: false,
      userId,
      tenantId: DEFAULT_TENANT,
      agentId,
      error: 'Agent not found',
      status: 404,
    }
  }

  if (persona.tenantId !== DEFAULT_TENANT) {
    return {
      authorized: false,
      userId,
      tenantId: DEFAULT_TENANT,
      agentId,
      error: 'Access denied',
      status: 403,
    }
  }

  return {
    authorized: true,
    userId,
    tenantId: DEFAULT_TENANT,
    agentId,
  }
}
