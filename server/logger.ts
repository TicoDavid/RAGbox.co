/**
 * Structured Logger — Server Module
 *
 * JSON-structured output for Cloud Run / Cloud Logging.
 * Drop-in replacement for console.log/warn/error in server/ files.
 *
 * S-P3-01
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
type LogLevel = keyof typeof LOG_LEVELS

const CURRENT_LEVEL: number =
  process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug

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

  if (extra.length === 1 && typeof extra[0] === 'object' && extra[0] !== null
      && !Array.isArray(extra[0]) && !(extra[0] instanceof Error)) {
    Object.assign(entry, extra[0])
  } else if (extra.length === 1) {
    entry.error = serializeExtra(extra[0])
  } else if (extra.length > 1) {
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
      console.info(JSON.stringify(entry))
  }
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => emit('debug', message, ...args),
  info: (message: string, ...args: unknown[]) => emit('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => emit('warn', message, ...args),
  error: (message: string, ...args: unknown[]) => emit('error', message, ...args),
}
