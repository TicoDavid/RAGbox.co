import {
  formatToolErrorForUser,
  isToolError,
  createErrorResponse,
  ToolErrorCodes,
} from './toolErrors'

describe('toolErrors', () => {
  describe('isToolError', () => {
    it('identifies valid ToolError objects', () => {
      const valid = { code: 'TEST', message: 'test', recoverable: true, suggestion: '' }
      expect(isToolError(valid)).toBe(true)
    })

    it('rejects objects missing required fields', () => {
      expect(isToolError({ message: 'test' })).toBe(false)
      expect(isToolError({ code: 'X', message: 'Y' })).toBe(false)
    })

    it('rejects non-objects', () => {
      expect(isToolError(null)).toBe(false)
      expect(isToolError(undefined)).toBe(false)
      expect(isToolError('string')).toBe(false)
      expect(isToolError(42)).toBe(false)
    })
  })

  describe('formatToolErrorForUser', () => {
    it('formats PERMISSION_DENIED correctly', () => {
      const error = {
        code: ToolErrorCodes.PERMISSION_DENIED,
        message: "Role 'user' cannot access tool 'admin_tool'",
        recoverable: false,
        suggestion: 'Contact your administrator.',
      }

      const result = formatToolErrorForUser(error)

      expect(result).toContain("don't have permission")
      expect(result).toContain('Contact your administrator')
    })

    it('formats TIMEOUT correctly', () => {
      const error = {
        code: ToolErrorCodes.TIMEOUT,
        message: 'Tool timed out after 30s',
        recoverable: true,
        suggestion: 'Try a smaller document.',
      }

      const result = formatToolErrorForUser(error)

      expect(result).toContain('timed out')
      expect(result).toContain('smaller document')
    })

    it('formats VALIDATION_FAILED with lowercased message', () => {
      const error = {
        code: ToolErrorCodes.VALIDATION_FAILED,
        message: "Invalid input for 'search': Missing query",
        recoverable: true,
        suggestion: 'Check your input.',
      }

      const result = formatToolErrorForUser(error)

      expect(result).toContain("couldn't process")
      expect(result).toContain('missing query')
    })

    it('formats FILE_ERROR correctly', () => {
      const error = {
        code: ToolErrorCodes.FILE_ERROR,
        message: 'File upload failed',
        recoverable: true,
        suggestion: 'Try re-exporting as PDF.',
      }

      const result = formatToolErrorForUser(error)

      expect(result).toContain('trouble with that file')
      expect(result).toContain('PDF')
    })

    it('formats UPSTREAM_FAILURE correctly', () => {
      const error = {
        code: ToolErrorCodes.UPSTREAM_FAILURE,
        message: 'Service unavailable',
        recoverable: true,
        suggestion: 'Please try again.',
      }

      const result = formatToolErrorForUser(error)

      expect(result).toContain('encountered an issue')
    })

    it('formats INTERNAL_ERROR correctly', () => {
      const error = {
        code: ToolErrorCodes.INTERNAL_ERROR,
        message: 'Unexpected error',
        recoverable: true,
        suggestion: 'Contact support.',
      }

      const result = formatToolErrorForUser(error)

      expect(result).toContain('unexpected')
      expect(result).toContain('Contact support')
    })

    it('formats TOOL_NOT_FOUND correctly', () => {
      const error = {
        code: ToolErrorCodes.TOOL_NOT_FOUND,
        message: 'Unknown tool: magic_tool',
        recoverable: false,
        suggestion: 'Not available in your plan.',
      }

      const result = formatToolErrorForUser(error)

      expect(result).toContain("isn't available")
    })

    it('falls back gracefully for unknown error codes', () => {
      const error = {
        code: 'UNKNOWN_CODE',
        message: 'Something weird',
        recoverable: true,
        suggestion: 'Try again.',
      }

      const result = formatToolErrorForUser(error)

      expect(result).toContain('Something weird')
      expect(result).toContain('Try again')
    })
  })

  describe('createErrorResponse', () => {
    it('creates a structured response with canRetry for recoverable errors', () => {
      const error = {
        code: ToolErrorCodes.TIMEOUT,
        message: 'Timed out',
        recoverable: true,
        suggestion: 'Try again.',
      }

      const response = createErrorResponse(error)

      expect(response.success).toBe(false)
      expect(response.canRetry).toBe(true)
      expect(response.error.code).toBe('TIMEOUT')
      expect(response.error.recoverable).toBe(true)
      expect(response.response).toContain('timed out')
    })

    it('sets canRetry false for non-recoverable errors', () => {
      const error = {
        code: ToolErrorCodes.PERMISSION_DENIED,
        message: 'No access',
        recoverable: false,
        suggestion: 'Ask admin.',
      }

      const response = createErrorResponse(error)

      expect(response.canRetry).toBe(false)
      expect(response.error.recoverable).toBe(false)
    })
  })
})
