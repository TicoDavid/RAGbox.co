/**
 * Structured logger utility — EPIC-016 P07, updated EPIC-017 S01
 *
 * JSON-structured output for Cloud Run / Cloud Logging.
 * Production suppresses debug, shows info+.
 * Development shows all levels including debug.
 *
 * Drop-in replacement for console.error/warn/log calls.
 * Accepts variadic args like console.* — extra args are captured in `details`.
 *
 * Usage:
 *   logger.error('[Tag] message')           → { severity: "ERROR", message: "[Tag] message" }
 *   logger.error('[Tag] msg:', err)          → { severity: "ERROR", message: "[Tag] msg:", error: "..." }
 *   logger.error('[Tag] msg', { key: val })  → { severity: "ERROR", message: "[Tag] msg", key: val }
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
type LogLevel = keyof typeof LOG_LEVELS

const CURRENT_LEVEL: number =
  process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug

/** Normalize an unknown value into a loggable form. */
function serializeExtra(val: unknown): unknown {
  if (val instanceof Error) {
    return { message: val.message, stack: val.stack }
  }
  return val
}

function emit(level: LogLevel, message: string, ...extra: unknown[]): void {
  if (LOG_LEVELS[level] < CURRENT_LEVEL) return

  const entry: Record<string, unknown> = {
    severity: level.toUpperCase(),
    message,
    timestamp: new Date().toISOString(),
  }

  // Single plain-object arg → spread as structured metadata
  if (extra.length === 1 && typeof extra[0] === 'object' && extra[0] !== null
      && !Array.isArray(extra[0]) && !(extra[0] instanceof Error)) {
    Object.assign(entry, extra[0])
  } else if (extra.length === 1) {
    // Single non-object arg (Error, string, number, etc.)
    entry.error = serializeExtra(extra[0])
  } else if (extra.length > 1) {
    // Multiple extra args → details array
    entry.details = extra.map(serializeExtra)
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
  debug: (message: string, ...args: unknown[]) => emit('debug', message, ...args),
  /** General operational info. Visible in all environments. */
  info: (message: string, ...args: unknown[]) => emit('info', message, ...args),
  /** Warning conditions. Always visible. */
  warn: (message: string, ...args: unknown[]) => emit('warn', message, ...args),
  /** Error conditions. Always visible. */
  error: (message: string, ...args: unknown[]) => emit('error', message, ...args),
}
