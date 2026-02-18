import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/gmail/token'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { agentId } = await params

  try {
    const accessToken = await getValidAccessToken(agentId)

    const credential = await prisma.agentEmailCredential.findUnique({
      where: { agentId },
    })

    if (!credential) {
      return NextResponse.json({ error: 'No credential found' }, { status: 404 })
    }

    // Look up persona name for the subject line
    const persona = await prisma.mercuryPersona.findUnique({
      where: { id: agentId },
      select: { firstName: true, lastName: true },
    })
    const agentName = persona
      ? `${persona.firstName} ${persona.lastName}`.trim()
      : 'Mercury'

    // RFC 2047 encode the subject to handle non-ASCII chars (em-dash, ö)
    const subjectText = `RAGb\u00f6x Email Test \u2014 ${agentName}`
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subjectText).toString('base64')}?=`

    // Build RFC 2822 email — test sends to itself
    const message = [
      'From: ' + credential.emailAddress,
      'To: ' + credential.emailAddress,
      'Subject: ' + encodedSubject,
      'Content-Type: text/plain; charset=utf-8',
      '',
      'This is a test email from your RAGbox agent. If you received this, email sending is working correctly.',
    ].join('\r\n')

    const raw = Buffer.from(message).toString('base64url')

    const gmailResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      }
    )

    if (!gmailResponse.ok) {
      const errorData = await gmailResponse.json().catch(() => ({}))
      return NextResponse.json(
        { error: 'Gmail send failed', details: errorData },
        { status: 502 }
      )
    }

    const result = await gmailResponse.json() as { id: string }

    return NextResponse.json({ success: true, messageId: result.id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Test email failed' },
      { status: 500 }
    )
  }
}
