import { NextRequest, NextResponse } from 'next/server'
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

  const redirectBase = process.env.GMAIL_OAUTH_REDIRECT_BASE || 'http://localhost:3000'
  const redirectUri = `${redirectBase}/api/agent/email/oauth/callback`

  const oauthParams = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: agentId,
  })

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${oauthParams.toString()}`

  return NextResponse.json({ url })
}
