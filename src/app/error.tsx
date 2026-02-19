'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-md text-center space-y-6 p-8">
        <div className="text-6xl font-bold text-[var(--danger)]">Error</div>
        <h1 className="text-xl font-semibold font-[family-name:var(--font-space)]">
          Something went wrong
        </h1>
        <p className="text-[var(--text-secondary)] text-sm">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-dim)] text-[var(--text-primary)] rounded-lg transition-colors text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
