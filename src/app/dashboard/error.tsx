'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      extra: { digest: error.digest, component: 'DashboardError' },
    })
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-md text-center space-y-6 p-8">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold font-[family-name:var(--font-space)]">
          Dashboard Error
        </h2>
        <p className="text-[var(--text-secondary)] text-sm">
          Something went wrong loading the dashboard. Your data is safe.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-dim)] text-[var(--text-primary)] rounded-lg transition-colors text-sm font-medium"
          >
            Retry
          </button>
          <a
            href="/dashboard"
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-[var(--text-primary)] rounded-lg transition-colors text-sm font-medium"
          >
            Reload Page
          </a>
        </div>
      </div>
    </div>
  )
}
