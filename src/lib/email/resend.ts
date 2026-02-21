/**
 * resend.ts — Resend.com email integration for OTP and Magic Link delivery.
 *
 * Uses the Resend REST API as a backup email sender.
 * Falls back to console.log when RESEND_API_KEY is not configured.
 *
 * @see https://resend.com/docs/api-reference/emails/send-email
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_ADDRESS = process.env.RESEND_FROM ?? 'RAGböx <noreply@ragbox.co>'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

interface ResendPayload {
  from: string
  to: string
  subject: string
  html: string
}

interface ResendResponse {
  id: string
}

async function send(payload: ResendPayload): Promise<{ id: string }> {
  if (!RESEND_API_KEY) {
    console.log('[Resend] API key not set — logging email instead:')
    console.log(`  To:      ${payload.to}`)
    console.log(`  Subject: ${payload.subject}`)
    console.log(`  Body:    ${payload.html.slice(0, 200)}...`)
    return { id: `dev-${Date.now()}` }
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend API error ${res.status}: ${body}`)
  }

  const data: ResendResponse = await res.json()
  return { id: data.id }
}

/**
 * Send a one-time password code to the user's email.
 */
export async function sendOTP(
  email: string,
  code: string,
): Promise<{ id: string }> {
  return send({
    from: FROM_ADDRESS,
    to: email,
    subject: `${code} is your RAGböx verification code`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #0A192F; margin-bottom: 8px;">Your verification code</h2>
        <p style="color: #475569; font-size: 14px; margin-bottom: 24px;">
          Enter this code to verify your identity:
        </p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0A192F;">${code}</span>
        </div>
        <p style="color: #94A3B8; font-size: 12px;">
          This code expires in 10 minutes. If you didn't request this, ignore this email.
        </p>
      </div>
    `,
  })
}

/**
 * Send a magic-link login email.
 */
export async function sendMagicLink(
  email: string,
  url: string,
): Promise<{ id: string }> {
  return send({
    from: FROM_ADDRESS,
    to: email,
    subject: 'Sign in to RAGböx',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #0A192F; margin-bottom: 8px;">Sign in to RAGböx</h2>
        <p style="color: #475569; font-size: 14px; margin-bottom: 24px;">
          Click the button below to securely sign in:
        </p>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${url}" style="display: inline-block; background: #2463EB; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Sign in
          </a>
        </div>
        <p style="color: #94A3B8; font-size: 12px;">
          This link expires in 15 minutes. If you didn't request this, ignore this email.
        </p>
        <p style="color: #94A3B8; font-size: 11px; word-break: break-all;">
          ${url}
        </p>
      </div>
    `,
  })
}
