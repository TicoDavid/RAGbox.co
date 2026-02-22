export function invoicePaidEmail(params: {
  amountFormatted: string
  invoiceUrl?: string
}) {
  const viewButton = params.invoiceUrl
    ? `<a href="${params.invoiceUrl}"
         style="display: inline-block; background: #D4A853; color: #0a0e1a; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 8px;">
        View Invoice &rarr;
      </a>`
    : ''

  return {
    subject: `RAGböx Payment Received — ${params.amountFormatted}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e1a; color: #e5e7eb; padding: 40px;">
        <h1 style="color: #D4A853; font-size: 24px; margin-bottom: 24px;">Payment Received</h1>
        <p style="margin-bottom: 12px;">Your payment of <strong>${params.amountFormatted}</strong> has been processed successfully.</p>
        <p style="margin-bottom: 24px;">Thank you for your continued trust in RAGböx.</p>
        ${viewButton}
        <hr style="border: none; border-top: 1px solid #1f2937; margin: 32px 0;" />
        <p style="font-size: 12px; color: #6b7280; line-height: 1.6;">
          RAGböx by ConnexUS AI Inc. | SOC 2 Type II | HIPAA Compliant<br/>
          Questions about billing? Reply to this email.
        </p>
      </div>
    `,
  }
}
