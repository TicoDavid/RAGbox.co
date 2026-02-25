import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | RAGbox.co',
  description: 'RAGbox.co Privacy Policy — How we handle your data, Gmail access, and security.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-secondary)]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-block text-sm text-[var(--brand-blue-hover)] hover:text-[var(--brand-blue)] transition-colors"
        >
          &larr; Back to RAGbox
        </Link>

        <h1 className="font-[family-name:var(--font-space)] text-4xl font-bold text-[var(--text-primary)] mb-2">
          RAGbox.co Privacy Policy
        </h1>
        <p className="text-[var(--text-tertiary)] mb-12">Last Updated: February 2026</p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">What We Collect</h2>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)]">
            <li>Account information (name, email via Google OAuth)</li>
            <li>Documents uploaded to your sovereign vault</li>
            <li>
              Email metadata when Gmail integration is enabled (sender, subject, date
              &mdash; NOT email body stored permanently)
            </li>
            <li>Conversation transcripts with AI assistants</li>
            <li>Usage analytics and interaction patterns</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">How We Use Gmail Access</h2>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)]">
            <li>
              <strong className="text-[var(--text-primary)]">Read emails:</strong> To enable AI agent email
              monitoring and response
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Send emails:</strong> To send AI-generated replies on
              behalf of your configured agent
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Manage labels:</strong> To organize processed vs.
              unprocessed emails
            </li>
            <li>We NEVER share email content with third parties</li>
            <li>We NEVER use email content for advertising</li>
            <li>
              Gmail data is processed in real-time and not stored beyond conversation context
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Data Retention</h2>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)]">
            <li>
              <strong className="text-[var(--text-primary)]">Documents:</strong> Retained until you delete them
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Conversation history:</strong> Retained for 90 days
              (configurable)
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Audit logs:</strong> 7 years (SEC 17a-4 compliance)
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Email credentials:</strong> Encrypted, deleted on
              disconnect
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Data Security</h2>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)]">
            <li>SOC 2 Type II + HIPAA compliant infrastructure</li>
            <li>
              All data encrypted at rest (Google Cloud KMS) and in transit (TLS 1.3)
            </li>
            <li>Document vault uses Customer-Managed Encryption Keys (CMEK)</li>
            <li>Row-Level Security ensures tenant isolation</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Your Rights</h2>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)]">
            <li>Access, export, or delete your data at any time</li>
            <li>
              Revoke Gmail access via Google Account settings or RAGbox dashboard
            </li>
            <li>
              Request complete data deletion:{' '}
              <a
                href="mailto:privacy@ragbox.co"
                className="text-[var(--brand-blue-hover)] hover:text-[var(--brand-blue)]"
              >
                privacy@ragbox.co
              </a>
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Contact</h2>
          <p className="text-[var(--text-secondary)]">ConnexUS AI Inc.</p>
          <p className="text-[var(--text-secondary)]">
            Email:{' '}
            <a
              href="mailto:privacy@ragbox.co"
              className="text-[var(--brand-blue-hover)] hover:text-[var(--brand-blue)]"
            >
              privacy@ragbox.co
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
