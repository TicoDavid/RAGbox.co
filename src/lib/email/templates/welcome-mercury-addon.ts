export function welcomeMercuryEmail(params: {
  userName: string
  mercuryName: string
}) {
  return {
    subject: `Protocol Mercury activated — ${params.mercuryName} can now speak`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e1a; color: #e5e7eb; padding: 40px;">
        <h1 style="color: #3b82f6; font-size: 24px; margin-bottom: 24px;">Mercury is Now Voice-Enabled</h1>
        <p style="margin-bottom: 12px;">Hi ${params.userName},</p>
        <p style="margin-bottom: 24px;"><strong>${params.mercuryName}</strong> just got a voice upgrade. Here&rsquo;s what&rsquo;s new:</p>
        <ul style="padding-left: 20px; margin-bottom: 24px; line-height: 1.8;">
          <li><strong>Voice conversations</strong> — click the mic button in your dashboard</li>
          <li><strong>Omnichannel</strong> — ${params.mercuryName} works across chat, voice, email, and SMS</li>
          <li><strong>24/7 availability</strong> — your digital hire never clocks out</li>
        </ul>
        <a href="https://app.ragbox.co/dashboard"
           style="display: inline-block; background: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 8px;">
          Talk to ${params.mercuryName} &rarr;
        </a>
        <hr style="border: none; border-top: 1px solid #1f2937; margin: 32px 0;" />
        <p style="font-size: 12px; color: #6b7280; line-height: 1.6;">
          RAGböx by ConnexUS AI Inc. | Your digital hire at $198/mo<br/>
          Questions? Reply to this email.
        </p>
      </div>
    `,
  }
}
