export function welcomeSovereignEmail(params: {
  userName: string
  mercuryName: string
}) {
  return {
    subject: `Welcome to RAGböx Sovereign — ${params.mercuryName} is ready`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e1a; color: #e5e7eb; padding: 40px;">
        <h1 style="color: #D4A853; font-size: 24px; margin-bottom: 24px;">Welcome to RAGböx Sovereign</h1>
        <p style="margin-bottom: 12px;">Hi ${params.userName},</p>
        <p style="margin-bottom: 24px;">Your AI assistant <strong>${params.mercuryName}</strong> is live and ready to work.</p>
        <h3 style="color: #D4A853; margin-bottom: 16px;">Get started in 3 steps:</h3>
        <ol style="padding-left: 20px; margin-bottom: 24px; line-height: 1.8;">
          <li><strong>Upload a document</strong> — PDF, DOCX, or TXT. ${params.mercuryName} learns instantly.</li>
          <li><strong>Ask a question</strong> — Type or speak. ${params.mercuryName} cites its sources.</li>
          <li><strong>Explore Studio</strong> — Generate reports, decks, and evidence timelines.</li>
        </ol>
        <a href="https://app.ragbox.co/dashboard"
           style="display: inline-block; background: #D4A853; color: #0a0e1a; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 8px;">
          Open RAGböx &rarr;
        </a>
        <hr style="border: none; border-top: 1px solid #1f2937; margin: 32px 0;" />
        <p style="font-size: 12px; color: #6b7280; line-height: 1.6;">
          RAGböx by ConnexUS AI Inc. | SOC 2 Type II | HIPAA Compliant<br/>
          Questions? Reply to this email or chat with ${params.mercuryName} in your dashboard.
        </p>
      </div>
    `,
  }
}
