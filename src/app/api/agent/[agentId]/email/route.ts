import { NextRequest, NextResponse } from 'next/server'
import { getCredentialStatus } from '@/lib/gmail/token'
import { authorizeAgentAccess } from '@/lib/agent/authorization'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
): Promise<NextResponse> {
  const { agentId } = await params

  const auth = await authorizeAgentAccess(agentId)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const cred = await getCredentialStatus(agentId)

  if (!cred) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    emailAddress: cred.emailAddress,
    provider: cred.provider,
    isActive: cred.isActive,
    lastRefreshed: cred.lastRefreshed,
    errorCount: cred.errorCount,
    lastError: cred.lastError,
    watchExpires: cred.watchExpires,
  })
}
