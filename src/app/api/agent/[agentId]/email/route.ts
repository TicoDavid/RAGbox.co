import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCredentialStatus } from '@/lib/gmail/token'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { agentId } = await params

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
