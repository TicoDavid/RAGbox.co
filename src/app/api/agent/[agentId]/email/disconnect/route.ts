import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decryptToken, isEncrypted } from '@/lib/gmail/crypto'
import { authorizeAgentAccess } from '@/lib/agent/authorization'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
): Promise<NextResponse> {
  const { agentId } = await params

  const auth = await authorizeAgentAccess(agentId)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const credential = await prisma.agentEmailCredential.findUnique({
      where: { agentId },
    })

    if (!credential) {
      return NextResponse.json({ error: 'No credential found' }, { status: 404 })
    }

    // Decrypt token for revocation (backward compatible with plaintext)
    let revokeToken = credential.refreshToken
    if (isEncrypted(revokeToken)) {
      revokeToken = await decryptToken(revokeToken)
    }

    // Revoke the refresh token at Google
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${revokeToken}`,
        { method: 'POST' }
      )
    } catch {
      // Revocation failure is non-fatal — token may already be expired
    }

    // Delete the credential from DB
    await prisma.agentEmailCredential.delete({
      where: { agentId },
    })

    // Update MercuryPersona: disable email
    await prisma.mercuryPersona.updateMany({
      where: { id: agentId },
      data: { emailEnabled: false, emailAddress: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Disconnect failed' },
      { status: 500 }
    )
  }
}
