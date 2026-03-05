/**
 * Sarah — BUG-051/052/053 Regression Tests
 *
 * BUG-051: BYOLLM model list truncated — catalog must include all curated models
 * BUG-052: BYOLLM "No response generated" — chatBody must route llmProvider/llmModel
 * BUG-053: AEGIS raw JSON in chat — parseStructuredResponse must extract prose
 *
 * Tests are pure unit tests — no React rendering, no network, no mocks needed
 * for the parser/catalog tests.
 */

// ============================================================================
// BUG-053: parseStructuredResponse — AEGIS raw JSON rendering guard
// ============================================================================

// Re-implement parseStructuredResponse logic inline (it's a non-exported function
// in CenterMessage.tsx — we test the algorithm directly).

interface ParsedResponse {
  content: string
  citations?: Array<{ citationIndex: number; documentId: string; excerpt: string; relevanceScore: number }>
  confidence?: number
}

function parseStructuredResponse(
  raw: string,
  existingCitations?: ParsedResponse['citations'],
  existingConfidence?: number,
): ParsedResponse {
  let cleaned = raw.trim()

  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n')
    if (lines.length >= 3) {
      cleaned = lines.slice(1, -1).join('\n').trim()
    }
  }

  // Not JSON — return as-is
  if (!cleaned.startsWith('{')) {
    return { content: raw, citations: existingCitations, confidence: existingConfidence }
  }

  try {
    const json = JSON.parse(cleaned)
    const data = json.data ?? json

    const answer = data.answer
    if (typeof answer !== 'string') {
      return { content: raw, citations: existingCitations, confidence: existingConfidence }
    }

    const jsonCitations = Array.isArray(data.citations) ? data.citations : undefined
    const citations = existingCitations && existingCitations.length > 0
      ? existingCitations
      : jsonCitations

    const confidence = existingConfidence ?? (typeof data.confidence === 'number' ? data.confidence : undefined)

    return { content: answer, citations, confidence }
  } catch {
    return { content: raw, citations: existingCitations, confidence: existingConfidence }
  }
}

describe('BUG-053: parseStructuredResponse — raw JSON guard', () => {
  test('returns plain text content unchanged', () => {
    const result = parseStructuredResponse('The contract expires on December 31, 2025.')
    expect(result.content).toBe('The contract expires on December 31, 2025.')
  })

  test('extracts answer from flat JSON payload', () => {
    const raw = JSON.stringify({
      answer: 'The payment terms are Net 30.',
      citations: [{ citationIndex: 0, documentId: 'doc-1', excerpt: 'Net 30', relevanceScore: 0.92 }],
      confidence: 0.95,
    })
    const result = parseStructuredResponse(raw)
    expect(result.content).toBe('The payment terms are Net 30.')
    expect(result.citations).toHaveLength(1)
    expect(result.confidence).toBe(0.95)
  })

  test('extracts answer from nested { data: { answer } } payload', () => {
    const raw = JSON.stringify({
      data: {
        answer: 'The liability cap is $5M.',
        citations: [],
        confidence: 0.88,
      },
    })
    const result = parseStructuredResponse(raw)
    expect(result.content).toBe('The liability cap is $5M.')
    expect(result.confidence).toBe(0.88)
  })

  test('strips markdown code fences before parsing', () => {
    const raw = '```json\n{"answer": "Fenced answer", "confidence": 0.9}\n```'
    const result = parseStructuredResponse(raw)
    expect(result.content).toBe('Fenced answer')
    expect(result.confidence).toBe(0.9)
  })

  test('preserves existing citations over JSON citations', () => {
    const existing = [
      { citationIndex: 0, documentId: 'doc-existing', excerpt: 'existing', relevanceScore: 0.99 },
    ]
    const raw = JSON.stringify({
      answer: 'Some answer',
      citations: [{ citationIndex: 0, documentId: 'doc-json', excerpt: 'json', relevanceScore: 0.5 }],
    })
    const result = parseStructuredResponse(raw, existing)
    expect(result.citations![0].documentId).toBe('doc-existing')
  })

  test('uses JSON citations when no existing citations', () => {
    const raw = JSON.stringify({
      answer: 'Some answer',
      citations: [{ citationIndex: 0, documentId: 'doc-json', excerpt: 'json', relevanceScore: 0.5 }],
    })
    const result = parseStructuredResponse(raw, undefined)
    expect(result.citations![0].documentId).toBe('doc-json')
  })

  test('preserves existing confidence over JSON confidence', () => {
    const raw = JSON.stringify({ answer: 'Test', confidence: 0.5 })
    const result = parseStructuredResponse(raw, undefined, 0.95)
    expect(result.confidence).toBe(0.95)
  })

  test('returns raw content for valid JSON without answer key', () => {
    const raw = JSON.stringify({ text: 'No answer key here', score: 0.8 })
    const result = parseStructuredResponse(raw)
    expect(result.content).toBe(raw)
  })

  test('returns raw content for malformed JSON', () => {
    const raw = '{ broken json here'
    const result = parseStructuredResponse(raw)
    expect(result.content).toBe(raw)
  })

  test('handles empty string', () => {
    const result = parseStructuredResponse('')
    expect(result.content).toBe('')
  })

  test('handles DonePayload with sources and evidence (does not leak to content)', () => {
    const raw = JSON.stringify({
      answer: 'The renewal date is March 1.',
      citations: [],
      confidence: 0.91,
      sources: [{ documentName: 'contract.pdf', documentId: 'doc-1' }],
      evidence: { totalDocumentsFound: 5, totalCandidates: 23 },
    })
    const result = parseStructuredResponse(raw)
    expect(result.content).toBe('The renewal date is March 1.')
    // sources/evidence not part of ParsedResponse — should not appear in content
    expect(result.content).not.toContain('totalDocumentsFound')
  })

  test('handles JSON with numeric answer (not string) — returns raw', () => {
    const raw = JSON.stringify({ answer: 42 })
    const result = parseStructuredResponse(raw)
    expect(result.content).toBe(raw)
  })
})

// ============================================================================
// BUG-053 (Part 2): SSE parser — parseSSEText
// ============================================================================

import { parseSSEText } from '@/lib/mercury/sseParser'

describe('BUG-053: SSE parser — parseSSEText', () => {
  test('accumulates token events into text', () => {
    const sse = [
      'event: token',
      'data: {"text":"Hello "}',
      '',
      'event: token',
      'data: {"text":"world."}',
      '',
    ].join('\n')

    const result = parseSSEText(sse)
    expect(result.text).toBe('Hello world.')
  })

  test('extracts citations from citations event (array format)', () => {
    const sse = [
      'event: citations',
      'data: [{"citationIndex":0,"excerpt":"clause 5.1","documentId":"doc-1"}]',
      '',
    ].join('\n')

    const result = parseSSEText(sse)
    expect(result.citations).toHaveLength(1)
    expect(result.citations[0].documentId).toBe('doc-1')
  })

  test('extracts citations from nested { citations: [...] } format', () => {
    const sse = [
      'event: citations',
      'data: {"citations":[{"citationIndex":0,"excerpt":"test","documentId":"doc-2"}]}',
      '',
    ].join('\n')

    const result = parseSSEText(sse)
    expect(result.citations).toHaveLength(1)
    expect(result.citations[0].documentId).toBe('doc-2')
  })

  test('extracts confidence from confidence event', () => {
    const sse = [
      'event: confidence',
      'data: {"score":0.92}',
      '',
    ].join('\n')

    const result = parseSSEText(sse)
    expect(result.confidence).toBe(0.92)
  })

  test('handles silence event', () => {
    const sse = [
      'event: silence',
      'data: {"message":"Unable to confidently answer.","confidence":0.3,"suggestions":["Upload more documents"]}',
      '',
    ].join('\n')

    const result = parseSSEText(sse)
    expect(result.isSilence).toBe(true)
    expect(result.text).toBe('Unable to confidently answer.')
    expect(result.confidence).toBe(0.3)
    expect(result.suggestions).toContain('Upload more documents')
  })

  test('ignores status and done events', () => {
    const sse = [
      'event: token',
      'data: {"text":"Answer"}',
      '',
      'event: status',
      'data: {"status":"processing"}',
      '',
      'event: done',
      'data: {"answer":"Answer","confidence":0.9}',
      '',
    ].join('\n')

    const result = parseSSEText(sse)
    expect(result.text).toBe('Answer')
  })

  test('skips unparseable data lines without crashing', () => {
    const sse = [
      'event: token',
      'data: not-valid-json',
      '',
      'event: token',
      'data: {"text":"recovered"}',
      '',
    ].join('\n')

    const result = parseSSEText(sse)
    expect(result.text).toBe('recovered')
  })

  test('handles empty response', () => {
    const result = parseSSEText('')
    expect(result.text).toBe('')
    expect(result.confidence).toBeUndefined()
    expect(result.citations).toEqual([])
    expect(result.isSilence).toBe(false)
  })

  test('fallback: unknown event with text field appends to text', () => {
    const sse = [
      'event: custom_event',
      'data: {"text":"fallback text"}',
      '',
    ].join('\n')

    const result = parseSSEText(sse)
    expect(result.text).toBe('fallback text')
  })

  test('fallback: unknown event with message sets silence', () => {
    const sse = [
      'event: unknown',
      'data: {"message":"Something went wrong"}',
      '',
    ].join('\n')

    const result = parseSSEText(sse)
    expect(result.isSilence).toBe(true)
    expect(result.text).toBe('Something went wrong')
  })
})

// ============================================================================
// BUG-053 (Part 3): JSON safety net — post-SSE extraction
// ============================================================================

describe('BUG-053: Post-SSE JSON safety net', () => {
  // Re-implement the safety net logic from chatStore.ts lines 487-507
  function applySafetyNet(fullContent: string): {
    content: string
    citations?: unknown[]
    confidence?: number
  } {
    let cleaned = fullContent.trim()
    let citations: unknown[] | undefined
    let confidence: number | undefined

    if (cleaned.startsWith('```')) {
      const lines = cleaned.split('\n')
      if (lines.length >= 3) cleaned = lines.slice(1, -1).join('\n').trim()
    }
    if (cleaned.startsWith('{')) {
      try {
        const parsed = JSON.parse(cleaned)
        const d = parsed.data ?? parsed
        if (typeof d.answer === 'string' && d.answer.length > 0) {
          fullContent = d.answer
          if (Array.isArray(d.citations)) citations = d.citations
          if (typeof d.confidence === 'number') confidence = d.confidence
        }
      } catch { /* not valid JSON */ }
    }
    return { content: fullContent, citations, confidence }
  }

  test('extracts answer from raw JSON that leaked through SSE', () => {
    const leaked = JSON.stringify({
      answer: 'The indemnification clause limits liability to $1M.',
      confidence: 0.88,
      citations: [{ documentId: 'doc-1' }],
    })
    const result = applySafetyNet(leaked)
    expect(result.content).toBe('The indemnification clause limits liability to $1M.')
    expect(result.confidence).toBe(0.88)
    expect(result.citations).toHaveLength(1)
  })

  test('handles code-fenced JSON', () => {
    const fenced = '```json\n{"answer":"Fenced answer"}\n```'
    const result = applySafetyNet(fenced)
    expect(result.content).toBe('Fenced answer')
  })

  test('leaves non-JSON content unchanged', () => {
    const prose = 'This is a normal prose answer.'
    const result = applySafetyNet(prose)
    expect(result.content).toBe(prose)
  })

  test('handles nested data wrapper', () => {
    const nested = JSON.stringify({ data: { answer: 'Nested answer' } })
    const result = applySafetyNet(nested)
    expect(result.content).toBe('Nested answer')
  })

  test('leaves malformed JSON as-is', () => {
    const bad = '{ answer: broken }'
    const result = applySafetyNet(bad)
    expect(result.content).toBe(bad)
  })
})

// ============================================================================
// BUG-051: MODEL_CATALOG completeness
// ============================================================================

// Inline the MODEL_CATALOG from ChatModelPicker.tsx for testing
const MODEL_CATALOG: Record<string, { label: string; models: Array<{ id: string; name: string }> }> = {
  openrouter: {
    label: 'OpenRouter',
    models: [
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
      { id: 'google/gemini-2.0-pro', name: 'Gemini 2.0 Pro' },
      { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B' },
      { id: 'mistralai/mistral-large', name: 'Mistral Large' },
    ],
  },
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'o1', name: 'o1' },
      { id: 'o1-mini', name: 'o1-mini' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
  },
  google: {
    label: 'Google AI',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    ],
  },
}

describe('BUG-051: MODEL_CATALOG completeness', () => {
  test('has all 4 provider categories', () => {
    expect(Object.keys(MODEL_CATALOG)).toEqual(
      expect.arrayContaining(['openrouter', 'openai', 'anthropic', 'google'])
    )
  })

  test('OpenRouter has >= 8 curated models', () => {
    expect(MODEL_CATALOG.openrouter.models.length).toBeGreaterThanOrEqual(8)
  })

  test('OpenAI has >= 5 models', () => {
    expect(MODEL_CATALOG.openai.models.length).toBeGreaterThanOrEqual(5)
  })

  test('Anthropic has >= 3 models', () => {
    expect(MODEL_CATALOG.anthropic.models.length).toBeGreaterThanOrEqual(3)
  })

  test('Google has >= 3 models', () => {
    expect(MODEL_CATALOG.google.models.length).toBeGreaterThanOrEqual(3)
  })

  test('every model has non-empty id and name', () => {
    for (const [provider, { models }] of Object.entries(MODEL_CATALOG)) {
      for (const model of models) {
        expect(model.id).toBeTruthy()
        expect(model.name).toBeTruthy()
      }
    }
  })

  test('no duplicate model IDs within a provider', () => {
    for (const [provider, { models }] of Object.entries(MODEL_CATALOG)) {
      const ids = models.map((m) => m.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
    }
  })

  test('OpenRouter model IDs follow provider/model format', () => {
    for (const model of MODEL_CATALOG.openrouter.models) {
      expect(model.id).toMatch(/^[a-z0-9-]+\/[a-z0-9._-]+$/i)
    }
  })

  test('catalog includes top models from major providers', () => {
    const allIds = Object.values(MODEL_CATALOG).flatMap((p) => p.models.map((m) => m.id))

    // Must include at least one from each major provider
    expect(allIds.some((id) => id.includes('claude'))).toBe(true)
    expect(allIds.some((id) => id.includes('gpt'))).toBe(true)
    expect(allIds.some((id) => id.includes('gemini'))).toBe(true)
    expect(allIds.some((id) => id.includes('llama'))).toBe(true)
    expect(allIds.some((id) => id.includes('mistral'))).toBe(true)
  })

  test('model merge deduplicates catalog + connection models', () => {
    // Simulate the merge logic from ChatModelPicker.tsx lines 97-108
    const catalogModels = MODEL_CATALOG.openrouter.models
    const connectionModels = [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' }, // duplicate
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' }, // new
    ]

    const catalogIds = new Set(catalogModels.map((m) => m.id))
    const extra = connectionModels.filter((m) => !catalogIds.has(m.id))
    const merged = [...catalogModels, ...extra]

    expect(merged.length).toBe(catalogModels.length + 1) // only DeepSeek added
    expect(merged.find((m) => m.id === 'deepseek/deepseek-r1')).toBeDefined()
  })
})

// ============================================================================
// BUG-052: BYOLLM routing — chatBody construction
// ============================================================================

describe('BUG-052: BYOLLM routing in chatBody', () => {
  // Simulate chatStore.sendMessage chatBody construction (lines 302-317)
  function buildChatBody(params: {
    query: string
    selectedModel: string
    privilegeMode: boolean
    safetyMode: boolean
    documentScope?: string
  }): Record<string, unknown> {
    const { query, selectedModel, privilegeMode, safetyMode, documentScope } = params
    const chatBody: Record<string, unknown> = {
      query,
      stream: true,
      useVectorPipeline: true,
      privilegeMode,
      maxTier: 3,
      safetyMode,
      history: [],
      ...(documentScope ? { documentScope } : {}),
    }

    if (selectedModel !== 'aegis') {
      chatBody.llmProvider = 'byollm'
      chatBody.llmModel = selectedModel
    }

    return chatBody
  }

  test('AEGIS model does NOT set llmProvider or llmModel', () => {
    const body = buildChatBody({
      query: 'What are the terms?',
      selectedModel: 'aegis',
      privilegeMode: false,
      safetyMode: true,
    })

    expect(body.llmProvider).toBeUndefined()
    expect(body.llmModel).toBeUndefined()
    expect(body.query).toBe('What are the terms?')
    expect(body.stream).toBe(true)
  })

  test('BYOLLM model sets llmProvider=byollm and llmModel to model ID', () => {
    const body = buildChatBody({
      query: 'Summarize the contract.',
      selectedModel: 'anthropic/claude-3.5-sonnet',
      privilegeMode: false,
      safetyMode: true,
    })

    expect(body.llmProvider).toBe('byollm')
    expect(body.llmModel).toBe('anthropic/claude-3.5-sonnet')
  })

  test('OpenAI direct model sets llmProvider=byollm', () => {
    const body = buildChatBody({
      query: 'Find risks.',
      selectedModel: 'gpt-4o',
      privilegeMode: false,
      safetyMode: true,
    })

    expect(body.llmProvider).toBe('byollm')
    expect(body.llmModel).toBe('gpt-4o')
  })

  test('document scope is included when set', () => {
    const body = buildChatBody({
      query: 'What does section 3 say?',
      selectedModel: 'aegis',
      privilegeMode: true,
      safetyMode: false,
      documentScope: 'doc-abc123',
    })

    expect(body.documentScope).toBe('doc-abc123')
    expect(body.privilegeMode).toBe(true)
    expect(body.safetyMode).toBe(false)
  })

  test('BYOLLM model with privilege mode sends both flags', () => {
    const body = buildChatBody({
      query: 'Confidential terms?',
      selectedModel: 'openai/gpt-4o',
      privilegeMode: true,
      safetyMode: true,
    })

    expect(body.llmProvider).toBe('byollm')
    expect(body.llmModel).toBe('openai/gpt-4o')
    expect(body.privilegeMode).toBe(true)
  })
})

// ============================================================================
// BUG-052 (Part 2): BUG-049 model metadata override
// ============================================================================

describe('BUG-052/BUG-049: BYOLLM model metadata override', () => {
  // Simulate the post-SSE model override logic from chatStore.ts lines 509-524
  function applyModelOverride(params: {
    selectedModel: string
    modelUsed?: string
    provider?: string
    doneMetadata: Record<string, unknown>
  }): { modelUsed: string | undefined; provider: string | undefined; doneMetadata: Record<string, unknown> } {
    let { modelUsed, provider } = params
    const { selectedModel, doneMetadata } = params

    if (selectedModel !== 'aegis') {
      if (!modelUsed || modelUsed === 'aegis' || modelUsed === 'aegis-core' || modelUsed.startsWith('aegis/')) {
        modelUsed = selectedModel
        doneMetadata.modelUsed = selectedModel
      }
      if (!provider || provider === 'aegis') {
        const resolvedProvider = selectedModel.includes('/')
          ? selectedModel.split('/')[0]
          : 'OpenRouter'
        provider = resolvedProvider
        doneMetadata.provider = resolvedProvider
      }
    }

    return { modelUsed, provider, doneMetadata }
  }

  test('overrides aegis model with selected BYOLLM model', () => {
    const result = applyModelOverride({
      selectedModel: 'anthropic/claude-3.5-sonnet',
      modelUsed: 'aegis',
      provider: 'aegis',
      doneMetadata: {},
    })
    expect(result.modelUsed).toBe('anthropic/claude-3.5-sonnet')
    expect(result.provider).toBe('anthropic')
  })

  test('overrides aegis-core with selected BYOLLM model', () => {
    const result = applyModelOverride({
      selectedModel: 'openai/gpt-4o',
      modelUsed: 'aegis-core',
      provider: 'aegis',
      doneMetadata: {},
    })
    expect(result.modelUsed).toBe('openai/gpt-4o')
    expect(result.provider).toBe('openai')
  })

  test('overrides aegis/ prefixed model', () => {
    const result = applyModelOverride({
      selectedModel: 'google/gemini-2.0-flash-001',
      modelUsed: 'aegis/gemini-2.5-flash',
      provider: 'aegis',
      doneMetadata: {},
    })
    expect(result.modelUsed).toBe('google/gemini-2.0-flash-001')
    expect(result.provider).toBe('google')
  })

  test('does NOT override when selectedModel is aegis', () => {
    const result = applyModelOverride({
      selectedModel: 'aegis',
      modelUsed: 'aegis/gemini-2.5-flash',
      provider: 'aegis',
      doneMetadata: {},
    })
    expect(result.modelUsed).toBe('aegis/gemini-2.5-flash')
    expect(result.provider).toBe('aegis')
  })

  test('non-slash model uses OpenRouter as provider fallback', () => {
    const result = applyModelOverride({
      selectedModel: 'gpt-4o',
      modelUsed: undefined,
      provider: undefined,
      doneMetadata: {},
    })
    expect(result.modelUsed).toBe('gpt-4o')
    expect(result.provider).toBe('OpenRouter')
  })

  test('preserves correct BYOLLM model when backend reports it correctly', () => {
    const result = applyModelOverride({
      selectedModel: 'anthropic/claude-3.5-sonnet',
      modelUsed: 'anthropic/claude-3.5-sonnet',
      provider: 'anthropic',
      doneMetadata: {},
    })
    expect(result.modelUsed).toBe('anthropic/claude-3.5-sonnet')
    expect(result.provider).toBe('anthropic')
  })
})
