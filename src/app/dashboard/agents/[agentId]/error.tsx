'use client'

import { useEffect } from 'react'
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { logger } from '@/lib/logger'

export default function AgentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('Agent page error boundary', { message: error.message, digest: error.digest })
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] text-center px-6">
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-[var(--danger)]" />
      </div>

      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        Something went wrong loading agent details
      </h2>
      <p className="text-sm text-[var(--text-tertiary)] max-w-sm mb-8">
        An unexpected error occurred. Please try again or return to the dashboard.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand-blue)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--brand-blue-hover)] transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Try again
        </button>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border-default)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
