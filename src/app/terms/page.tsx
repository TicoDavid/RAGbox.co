import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | RAGbox.co',
  description: 'RAGbox.co Terms of Service — Usage terms and conditions.',
}

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-[var(--text-tertiary)] mb-12">Last Updated: February 2026</p>

        <section className="mb-10">
          <p className="text-[var(--text-secondary)]">
            Terms of Service for RAGbox.co are being finalized. For questions, contact{' '}
            <a
              href="mailto:david@theconnexus.ai"
              className="text-[var(--brand-blue-hover)] hover:text-[var(--brand-blue)]"
            >
              david@theconnexus.ai
            </a>.
          </p>
        </section>
      </div>
    </div>
  )
}
