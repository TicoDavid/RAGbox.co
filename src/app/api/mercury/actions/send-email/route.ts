/**
 * Mercury Email Action — Gmail API
 *
 * POST /api/mercury/actions/send-email
 * Body: { to: string, subject: string, body: string, agentId?: string, replyToMessageId?: string }
 *
 * Mode 1 (Agent): If agentId provided, sends FROM the agent's stored Gmail credential.
 * Mode 2 (Legacy): If no agentId, sends FROM the session user's OAuth token.
 * Logs to MercuryAction for audit trail.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/gmail/token'
import { authorizeAgentAccessJWT } from '@/lib/agent/authorization'
import { isGmailConfigured, sendViaGmail as sendSystemGmail } from '@/lib/email/gmail'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
    }

    const reqBody = await request.json()
    const { to, subject, body: emailBody, agentId, replyToMessageId } = reqBody

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address format' },
        { status: 400 }
      )
    }

    let accessToken: string
    let fromEmail: string

    if (agentId) {
      // === Agent credential mode — verify tenant authorization ===
      const agentAuth = await authorizeAgentAccessJWT(request, agentId)
      if (!agentAuth.authorized) {
        return NextResponse.json(
          { success: false, error: agentAuth.error },
          { status: agentAuth.status }
        )
      }

      try {
        accessToken = await getValidAccessToken(agentId)
      } catch (error) {
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : 'Agent token refresh failed' },
          { status: 403 }
        )
      }
      const cred = await prisma.agentEmailCredential.findUnique({
        where: { agentId },
      })
      if (!cred) {
        return NextResponse.json({ success: false, error: 'No email credential for agent' }, { status: 404 })
      }
      fromEmail = cred.emailAddress
    } else {
      // === LEGACY: Session user mode ===
      const sessionToken = token.accessToken as string | undefined
      if (!sessionToken || (token.provider && token.provider !== 'google')) {
        // No user OAuth token — fall back to system Gmail (Sarah's refresh token flow)
        if (isGmailConfigured()) {
          try {
            const result = await sendSystemGmail(to, subject, emailBody)
            await logMercuryAction(userId, 'email', to, subject, emailBody, 'completed', {
              messageId: result.id,
              via: 'system-gmail',
            }, null)
            await writeMercuryThread(userId, to, subject)
            return NextResponse.json({ success: true, data: { messageId: result.id, via: 'system-gmail' } })
          } catch (error) {
            console.error('[Mercury Email] System Gmail fallback failed:', error)
            return NextResponse.json(
              { success: false, error: 'Email sending failed. System Gmail credentials may be misconfigured.' },
              { status: 502 }
            )
          }
        }

        return NextResponse.json(
          { success: false, error: 'No OAuth token available. Please sign out and sign in again with Google.' },
          { status: 403 }
        )
      }
      accessToken = sessionToken
      fromEmail = (token.email as string) || ''
    }

    // Build RFC 2822 message
    const headers = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
    ]

    // Thread replies in Gmail via In-Reply-To / References
    if (replyToMessageId) {
      headers.push(`In-Reply-To: ${replyToMessageId}`)
      headers.push(`References: ${replyToMessageId}`)
    }

    const rfc2822 = [...headers, '', emailBody].join('\r\n')

    // Base64url encode
    const raw = Buffer.from(rfc2822)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Attempt to send
    let sendResult = await sendViaGmail(accessToken, raw)

    // If 401 on legacy mode, try refreshing the token
    if (!sendResult.ok && sendResult.status === 401 && !agentId) {
      const refreshToken = token.refreshToken as string | undefined
      if (refreshToken) {
        const refreshed = await refreshGoogleToken(refreshToken)
        if (refreshed.accessToken) {
          accessToken = refreshed.accessToken
          sendResult = await sendViaGmail(accessToken, raw)
        }
      }
    }

    if (!sendResult.ok) {
      const errorDetail = sendResult.errorMessage || `Gmail API returned ${sendResult.status}`

      // Log failed action
      await logMercuryAction(userId, 'email', to, subject, emailBody, 'failed', { error: errorDetail }, agentId || null)

      if (sendResult.status === 403) {
        return NextResponse.json(
          { success: false, error: 'Mercury needs email permission. Please re-authenticate with Google to approve the Gmail send scope.' },
          { status: 403 }
        )
      }
      if (sendResult.status === 429) {
        return NextResponse.json(
          { success: false, error: 'Gmail rate limit reached. Try again in a few minutes.' },
          { status: 429 }
        )
      }

      return NextResponse.json({ success: false, error: errorDetail }, { status: 502 })
    }

    // Log successful action
    await logMercuryAction(userId, 'email', to, subject, emailBody, 'completed', {
      messageId: sendResult.messageId,
      gmailThreadId: sendResult.threadId,
    }, agentId || null)

    // Write to Mercury unified thread
    await writeMercuryThread(userId, to, subject)

    return NextResponse.json({
      success: true,
      data: {
        messageId: sendResult.messageId,
        threadId: sendResult.threadId,
      },
    })
  } catch (error) {
    console.error('[Mercury Email] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    )
  }
}

// =============================================================================

async function sendViaGmail(
  accessToken: string,
  rawMessage: string,
): Promise<{ ok: boolean; status: number; messageId?: string; threadId?: string; errorMessage?: string }> {
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMessage }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[Mercury Email] Gmail API error:', res.status, errBody)
      return { ok: false, status: res.status, errorMessage: `Gmail API error: ${res.status}` }
    }

    const data = await res.json()
    return { ok: true, status: 200, messageId: data.id, threadId: data.threadId }
  } catch (error) {
    return { ok: false, status: 500, errorMessage: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function refreshGoogleToken(
  refreshToken: string,
): Promise<{ accessToken?: string }> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) return {}

    const data = await res.json()
    return { accessToken: data.access_token }
  } catch {
    return {}
  }
}

async function logMercuryAction(
  userId: string,
  actionType: string,
  recipient: string,
  subject: string,
  body: string,
  status: string,
  metadata: Record<string, unknown>,
  agentId: string | null,
): Promise<void> {
  try {
    await prisma.mercuryAction.create({
      data: {
        userId,
        agentId,
        actionType,
        recipient,
        subject,
        body,
        status,
        metadata: metadata as Record<string, string>,
      },
    })
  } catch (error) {
    console.error('[Mercury Email] Action log failed:', error)
  }
}

async function writeMercuryThread(userId: string, to: string, subject: string): Promise<void> {
  try {
    let thread = await prisma.mercuryThread.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    })
    if (!thread) {
      thread = await prisma.mercuryThread.create({
        data: { userId, title: 'Mercury Thread' },
        select: { id: true },
      })
    }

    await prisma.mercuryThreadMessage.create({
      data: {
        threadId: thread.id,
        role: 'assistant',
        channel: 'email',
        content: `Email sent to ${to}: "${subject}"`,
      },
    })
  } catch (error) {
    console.error('[Mercury Email] Thread write failed:', error)
  }
}
