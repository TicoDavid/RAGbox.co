import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Wrap a Next.js API route handler with Sentry error capture.
 * If SENTRY_DSN is not set, Sentry.init is a no-op so this
 * simply re-throws without side-effects.
 */
export function withSentry(
  handler: (req: NextRequest, ctx?: unknown) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ctx?: unknown): Promise<NextResponse> => {
    try {
      return await handler(req, ctx)
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          url: req.url,
          method: req.method,
        },
      })
      throw error
    }
  }
}

/**
 * Manually capture an error with optional context.
 * No-op when Sentry is not initialized (DSN missing).
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
) {
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

/**
 * Manually capture a message (info/warning level).
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level)
}
