'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { logger } from '@/lib/logger'

interface ChatErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ChatErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('[ChatErrorBoundary] Render error in chat pipeline:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)] p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--danger)]/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-[var(--danger)]" />
            </div>

            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              The chat encountered an error. Your data is safe — click retry to reload.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="text-xs text-left text-[var(--danger)] bg-[var(--danger)]/5 border border-[var(--danger)]/20 rounded-lg p-3 mb-6 overflow-x-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}

            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
                         bg-[var(--brand-blue)] text-white text-sm font-medium
                         hover:brightness-110 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
