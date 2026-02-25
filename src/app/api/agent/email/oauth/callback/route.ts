import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { encryptToken } from '@/lib/gmail/crypto'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // agentId
  const error = searchParams.get('error')

  const baseUrl = process.env.GMAIL_OAUTH_REDIRECT_BASE || 'http://localhost:3000'

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard/settings/mercury?email_error=${encodeURIComponent(error)}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard/settings/mercury?email_error=missing_params`
    )
  }

  const redirectUri = `${baseUrl}/api/agent/email/oauth/callback`

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json().catch(() => ({}))
      logger.error('OAuth token exchange failed:', errData)
      return NextResponse.redirect(
        `${baseUrl}/dashboard/settings/mercury?email_error=token_exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token as string
    const refreshToken = tokenData.refresh_token as string | undefined
    const scope = (tokenData.scope as string) || ''

    if (!refreshToken) {
      return NextResponse.redirect(
        `${baseUrl}/dashboard/settings/mercury?email_error=no_refresh_token`
      )
    }

    // Encrypt the refresh token before storage
    const encryptedRefreshToken = await encryptToken(refreshToken)

    // Get user's email address from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(
        `${baseUrl}/dashboard/settings/mercury?email_error=userinfo_failed`
      )
    }

    const userInfo = await userInfoResponse.json()
    const email = userInfo.email as string

    // Upsert agent email credential
    const credId = crypto.randomUUID().replace(/-/g, '').substring(0, 25)

    await prisma.agentEmailCredential.upsert({
      where: { agentId: state },
      create: {
        id: credId,
        agentId: state,
        emailAddress: email,
        provider: 'google',
        refreshToken: encryptedRefreshToken,
        scopes: scope,
        isActive: true,
        lastRefreshed: new Date(),
      },
      update: {
        emailAddress: email,
        refreshToken: encryptedRefreshToken,
        scopes: scope,
        isActive: true,
        errorCount: 0,
        lastError: null,
        lastRefreshed: new Date(),
      },
    })

    // Update MercuryPersona (safe — no error if persona doesn't exist)
    await prisma.mercuryPersona.updateMany({
      where: { id: state },
      data: { emailEnabled: true, emailAddress: email },
    })

    return NextResponse.redirect(
      `${baseUrl}/dashboard/settings/mercury?email=connected`
    )
  } catch (err) {
    logger.error('OAuth callback error:', err)
    return NextResponse.redirect(
      `${baseUrl}/dashboard/settings/mercury?email_error=internal_error`
    )
  }
}
