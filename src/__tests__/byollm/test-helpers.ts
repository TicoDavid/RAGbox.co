/**
 * BYOLLM Integration Test Helpers
 *
 * Factory functions for mocking tenants, LLMConfigs, and LLM provider
 * responses. Used across all BYOLLM integration tests.
 *
 * STORY-027 | Stubbed — do not implement until backend wiring is complete.
 */

// ── Types ───────────────────────────────────────────────────

/** Policy governs which LLM backend a tenant is allowed to use. */
export type LLMPolicy = 'choice' | 'byollm_only' | 'aegis_only'

/** Mirrors the Prisma LLMConfig model shape. */
export interface MockLLMConfig {
  id: string
  tenantId: string
  provider: string
  apiKeyEncrypted: string
  baseUrl: string | null
  defaultModel: string | null
  policy: LLMPolicy
  lastTestedAt: Date | null
  lastTestResult: string | null
  lastTestLatency: number | null
  createdAt: Date
  updatedAt: Date
}

/** Minimal tenant shape for test isolation. */
export interface MockTenant {
  id: string
  name: string
  slug: string
  llmConfig: MockLLMConfig | null
}

/** Shape of a chat response from the Go backend (SSE parsed). */
export interface MockChatResponse {
  answer: string
  citations: Array<{
    chunkId: string
    documentId: string
    excerpt: string
    relevance: number
    index: number
  }>
  confidence: number
  modelUsed: string
  latencyMs: number
}

// ── Tenant Factory ──────────────────────────────────────────

/**
 * Create a mock tenant WITHOUT an LLMConfig (AEGIS-only, default behavior).
 * Simulates a tenant who has not configured BYOLLM.
 */
export function createTenantWithoutLLMConfig(
  overrides: Partial<MockTenant> = {},
): MockTenant {
  return {
    id: 'tenant-no-llm',
    name: 'AEGIS Default Corp',
    slug: 'aegis-default',
    llmConfig: null,
    ...overrides,
  }
}

/**
 * Create a mock tenant WITH a valid LLMConfig (BYOLLM enabled).
 * Default: OpenRouter provider, policy=choice, valid encrypted key.
 */
export function createTenantWithLLMConfig(
  overrides: Partial<MockLLMConfig> = {},
  tenantOverrides: Partial<MockTenant> = {},
): MockTenant {
  const now = new Date()
  const config: MockLLMConfig = {
    id: 'llmcfg-test-001',
    tenantId: 'tenant-byollm',
    provider: 'openrouter',
    apiKeyEncrypted: 'encrypted:sk-or-v1-FAKE_KEY_FOR_TESTING',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4-20250514',
    policy: 'choice',
    lastTestedAt: now,
    lastTestResult: 'ok',
    lastTestLatency: 450,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }

  return {
    id: config.tenantId,
    name: 'BYOLLM Test Corp',
    slug: 'byollm-test',
    llmConfig: config,
    ...tenantOverrides,
  }
}

/**
 * Create a mock tenant with an INVALID LLMConfig (bad API key).
 * Used to test AEGIS fallback behavior.
 */
export function createTenantWithInvalidLLMConfig(
  overrides: Partial<MockLLMConfig> = {},
): MockTenant {
  return createTenantWithLLMConfig({
    apiKeyEncrypted: 'encrypted:sk-or-v1-INVALID_EXPIRED_KEY',
    lastTestResult: 'error: 401 Unauthorized',
    lastTestLatency: null,
    ...overrides,
  })
}

// ── OpenRouter Response Factory ─────────────────────────────

/**
 * Create a mock successful OpenRouter chat completion response.
 * Mirrors the OpenRouter /api/v1/chat/completions response shape.
 */
export function createOpenRouterResponse(
  overrides: Partial<{
    answer: string
    model: string
    latencyMs: number
  }> = {},
): MockChatResponse {
  return {
    answer: overrides.answer ?? 'The NDA establishes a three-year confidentiality term [1].',
    citations: [
      {
        chunkId: 'chunk-or-001',
        documentId: 'doc-nda-001',
        excerpt: 'This Agreement shall remain in effect for a period of three (3) years',
        relevance: 0.95,
        index: 1,
      },
    ],
    confidence: 0.91,
    modelUsed: overrides.model ?? 'anthropic/claude-sonnet-4-20250514',
    latencyMs: overrides.latencyMs ?? 1200,
  }
}

/**
 * Create a mock OpenRouter error response (invalid key, rate limit, etc.).
 */
export function createOpenRouterErrorResponse(
  statusCode: number = 401,
  message: string = 'Invalid API key',
): { status: number; error: { message: string; type: string } } {
  return {
    status: statusCode,
    error: {
      message,
      type: statusCode === 429 ? 'rate_limit_error' : 'authentication_error',
    },
  }
}

// ── AEGIS Response Factory ──────────────────────────────────

/**
 * Create a mock successful AEGIS (Vertex AI / Gemini) response.
 * This is the default RAGbox backend response when no BYOLLM is configured.
 */
export function createAegisResponse(
  overrides: Partial<{
    answer: string
    model: string
    latencyMs: number
  }> = {},
): MockChatResponse {
  return {
    answer: overrides.answer ?? 'The NDA establishes a three-year confidentiality term [1].',
    citations: [
      {
        chunkId: 'chunk-aegis-001',
        documentId: 'doc-nda-001',
        excerpt: 'This Agreement shall remain in effect for a period of three (3) years',
        relevance: 0.95,
        index: 1,
      },
    ],
    confidence: 0.91,
    modelUsed: overrides.model ?? 'gemini-2.0-flash-001',
    latencyMs: overrides.latencyMs ?? 800,
  }
}

// ── SSE Stream Helpers ──────────────────────────────────────

/** SSE frame shape matching the Go backend format. */
interface SSEFrame {
  event: string
  data: string
}

/**
 * Build an array of SSE frames from a MockChatResponse.
 * Mirrors the Go backend chat handler SSE event sequence:
 *   status(retrieving) → status(generating) → token* → citations → confidence → done
 */
export function chatResponseToSSEFrames(response: MockChatResponse): SSEFrame[] {
  const tokens = response.answer.split(' ')
  const frames: SSEFrame[] = [
    { event: 'status', data: '{"stage":"retrieving"}' },
    { event: 'status', data: '{"stage":"generating","iteration":1}' },
  ]

  tokens.forEach((token, i) => {
    const text = i < tokens.length - 1 ? `${token} ` : token
    frames.push({ event: 'token', data: JSON.stringify({ text }) })
  })

  frames.push({ event: 'citations', data: JSON.stringify(response.citations) })
  frames.push({
    event: 'confidence',
    data: JSON.stringify({ score: response.confidence, iterations: 1 }),
  })
  frames.push({ event: 'done', data: '{}' })

  return frames
}

/**
 * Encode SSE frames into a ReadableStream<Uint8Array> for mocking fetch responses.
 */
export function sseStream(frames: SSEFrame[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const payload = frames.map(f => `event: ${f.event}\ndata: ${f.data}\n\n`).join('')
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload))
      controller.close()
    },
  })
}

// ── API Key Helpers ─────────────────────────────────────────

/** The raw (unencrypted) test API key — never appears in responses. */
export const TEST_RAW_API_KEY = 'sk-or-v1-abc123def456ghi789jkl012mno345pqr678stu901vwx234'

/** Expected masked version: first 5 + *** + last 3 */
export const TEST_MASKED_API_KEY = 'sk-or***234'

/**
 * Simulate what the masked key should look like for any given raw key.
 * Rule: first 5 characters + '***' + last 3 characters.
 */
export function maskApiKey(rawKey: string): string {
  if (rawKey.length <= 8) return '***'
  return `${rawKey.slice(0, 5)}***${rawKey.slice(-3)}`
}
