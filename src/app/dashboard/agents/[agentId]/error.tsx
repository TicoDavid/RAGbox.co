'use client'

import { useEffect } from 'react'
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react'
import Link from 'next/link'

export default function AgentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to monitoring — no console.log in production
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] text-center px-6">
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>

      <h2 className="text-lg font-semibold text-white mb-2">
        Something went wrong loading agent details
      </h2>
      <p className="text-sm text-slate-500 max-w-sm mb-8">
        An unexpected error occurred. Please try again or return to the dashboard.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand-blue)] text-white text-sm font-medium hover:bg-[var(--brand-blue-hover)] transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Try again
        </button>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
