'use client'

import Link from 'next/link'
import { ArrowLeft, CreditCard } from 'lucide-react'

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)] mb-6">
          <CreditCard className="w-8 h-8 text-[var(--brand-blue)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Billing</h1>
        <p className="text-[var(--text-secondary)] mb-4">
          Billing portal is available after your first subscription payment.
        </p>
        <p className="text-[var(--text-tertiary)] text-sm mb-6">
          Contact{' '}
          <a href="mailto:support@ragbox.co" className="text-[var(--brand-blue)] hover:text-[var(--brand-blue-hover)] transition-colors underline">
            support@ragbox.co
          </a>
          {' '}for billing questions.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-[var(--brand-blue)] hover:text-[var(--brand-blue-hover)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
