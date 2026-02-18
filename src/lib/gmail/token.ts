import prisma from '@/lib/prisma'

export class GmailAuthError extends Error {
  constructor(message: string, public agentId: string) {
    super(message)
    this.name = 'GmailAuthError'
  }
}

export async function getValidAccessToken(agentId: string): Promise<string> {
  const credential = await prisma.agentEmailCredential.findUnique({
    where: { agentId },
  })

  if (!credential) {
    throw new GmailAuthError('No email credential found for agent', agentId)
  }

  if (!credential.isActive) {
    throw new GmailAuthError('Email credential is disabled', agentId)
  }

  // Refresh the access token using the stored refresh token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: credential.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    // Increment error count
    await prisma.agentEmailCredential.update({
      where: { agentId },
      data: {
        errorCount: { increment: 1 },
        lastError: JSON.stringify(errorData),
        // Disable after 5 consecutive failures
        isActive: credential.errorCount >= 4 ? false : undefined,
      },
    })
    throw new GmailAuthError(
      `Token refresh failed: ${(errorData as Record<string, string>).error || 'unknown'}`,
      agentId
    )
  }

  const tokenData = await response.json()

  // Reset error count on success, update lastRefreshed
  await prisma.agentEmailCredential.update({
    where: { agentId },
    data: {
      lastRefreshed: new Date(),
      errorCount: 0,
      lastError: null,
    },
  })

  return (tokenData as Record<string, string>).access_token
}

// Helper: get credential info (safe — never returns refreshToken)
export async function getCredentialStatus(agentId: string) {
  const cred = await prisma.agentEmailCredential.findUnique({
    where: { agentId },
    select: {
      id: true,
      agentId: true,
      emailAddress: true,
      provider: true,
      isActive: true,
      lastRefreshed: true,
      errorCount: true,
      lastError: true,
      watchExpires: true,
      createdAt: true,
    },
  })
  return cred
}
