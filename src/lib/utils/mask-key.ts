/**
 * API Key Masking Utility
 *
 * Masks API keys for safe display in UI and API responses.
 * Rule: first 5 characters + "***" + last 3 characters.
 * Keys shorter than 10 characters are fully masked.
 */

/**
 * Mask an API key for safe display.
 *
 * @example maskApiKey('sk-or-v1-abc123...xyz') → 'sk-or***xyz'
 * @example maskApiKey('short') → '***'
 */
export function maskApiKey(key: string): string {
  if (key.length < 10) return '***'
  return `${key.slice(0, 5)}***${key.slice(-3)}`
}
