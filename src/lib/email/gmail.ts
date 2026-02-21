/**
 * gmail.ts — Gmail API transport for system emails (OTP, magic link).
 *
 * Uses OAuth2 refresh-token flow with dedicated credentials:
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 *
 * Falls back gracefully when credentials are not configured.
 */

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID ?? ''
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET ?? ''
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN ?? ''
const GMAIL_FROM = process.env.GMAIL_FROM ?? 'RAGbox <noreply@ragbox.co>'

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GMAIL_SEND_ENDPOINT =
  'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'

/** True when all three Gmail env vars are set. */
export function isGmailConfigured(): boolean {
  return !!(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN)
}

/** Exchange refresh token for a short-lived access token. */
async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gmail token refresh failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

/** Build an RFC 2822 message and base64url-encode it for the Gmail API. */
function buildRawMessage(to: string, subject: string, html: string): string {
  const headers = [
    `From: ${GMAIL_FROM}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
  ]

  const rfc2822 = [...headers, '', html].join('\r\n')

  return Buffer.from(rfc2822)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Send an email via the Gmail API. Returns the Gmail message ID. */
export async function sendViaGmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ id: string }> {
  const accessToken = await getAccessToken()
  const raw = buildRawMessage(to, subject, html)

  const res = await fetch(GMAIL_SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gmail send failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as { id: string }
  return { id: data.id }
}
