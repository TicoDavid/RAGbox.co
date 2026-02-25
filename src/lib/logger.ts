/**
 * Minimal structured logger — Jordan EPIC-016 P02
 *
 * Wraps console.warn / console.error with JSON-structured output
 * for Cloud Run / Cloud Logging. Replaces raw console.log calls
 * in production code with severity-tagged output.
 *
 * Sheldon may replace this with a full logger (P07). This is
 * intentionally minimal so it's easy to swap.
 */

type LogLevel = 'info' | 'warn' | 'error'

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    severity: level.toUpperCase(),
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  }

  switch (level) {
    case 'error':
      console.error(JSON.stringify(entry))
      break
    case 'warn':
      console.warn(JSON.stringify(entry))
      break
    default:
      // Use console.info (not console.log) — console.log is banned in production
      console.info(JSON.stringify(entry))
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
}
