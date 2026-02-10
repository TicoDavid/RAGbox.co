/**
 * Tool Error Handling for Mercury
 * Converts structured backend errors into natural language responses.
 */

export interface ToolError {
  code: string
  message: string
  recoverable: boolean
  suggestion: string
}

// Error code constants (must match Go backend tools.ErrCode* values)
export const ToolErrorCodes = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  TIMEOUT: 'TIMEOUT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UPSTREAM_FAILURE: 'UPSTREAM_FAILURE',
  FILE_ERROR: 'FILE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
} as const

export type ToolErrorCode = typeof ToolErrorCodes[keyof typeof ToolErrorCodes]

/**
 * Type guard to check if an error is a ToolError.
 */
export function isToolError(error: unknown): error is ToolError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'recoverable' in error
  )
}

/**
 * Convert a ToolError into natural language for Mercury to speak.
 */
export function formatToolErrorForUser(error: ToolError): string {
  const templates: Record<string, (e: ToolError) => string> = {
    [ToolErrorCodes.PERMISSION_DENIED]: (e) =>
      `I don't have permission to perform that action. ${e.suggestion}`,

    [ToolErrorCodes.TIMEOUT]: (e) =>
      `That operation took too long and timed out. ${e.suggestion}`,

    [ToolErrorCodes.VALIDATION_FAILED]: (e) =>
      `I couldn't process that request \u2014 ${e.message.toLowerCase()}. ${e.suggestion}`,

    [ToolErrorCodes.FILE_ERROR]: (e) =>
      `I had trouble with that file. ${e.suggestion}`,

    [ToolErrorCodes.UPSTREAM_FAILURE]: (e) =>
      `I encountered an issue completing that request. ${e.suggestion}`,

    [ToolErrorCodes.INTERNAL_ERROR]: (e) =>
      `Something unexpected happened on my end. ${e.suggestion}`,

    [ToolErrorCodes.TOOL_NOT_FOUND]: (e) =>
      `That capability isn't available right now. ${e.suggestion}`,
  }

  const formatter = templates[error.code]

  if (formatter) {
    return formatter(error)
  }

  // Fallback for unknown error codes
  return `I encountered an issue: ${error.message}. ${error.suggestion || 'Please try again.'}`
}

/**
 * Create a Mercury-style error response object.
 */
export function createErrorResponse(error: ToolError) {
  return {
    success: false as const,
    response: formatToolErrorForUser(error),
    error: {
      code: error.code,
      recoverable: error.recoverable,
    },
    canRetry: error.recoverable,
  }
}
