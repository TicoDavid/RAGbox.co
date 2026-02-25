/**
 * Structured logger utility — EPIC-016 P07
 *
 * JSON-structured output for Cloud Run / Cloud Logging.
 * Production suppresses debug, shows info+.
 * Development shows all levels including debug.
 *
 * No external dependencies. Drop-in replacement for console.log calls.
 * Jordan can use `logger.debug()` for dev-only output that vanishes in prod.
 *
 * Replaces Jordan's P02 minimal logger with debug level + level filtering.
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
type LogLevel = keyof typeof LOG_LEVELS

const CURRENT_LEVEL: number =
  process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] < CURRENT_LEVEL) return

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
    case 'debug':
      console.debug(JSON.stringify(entry))
      break
    default:
      // info → console.info (not console.log — console.log is banned in production)
      console.info(JSON.stringify(entry))
  }
}

export const logger = {
  /** Dev-only output. Suppressed in production. */
  debug: (message: string, meta?: Record<string, unknown>) => emit('debug', message, meta),
  /** General operational info. Visible in all environments. */
  info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
  /** Warning conditions. Always visible. */
  warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
  /** Error conditions. Always visible. */
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
}
