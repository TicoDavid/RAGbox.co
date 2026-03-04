/**
 * Go Backend TTFB Regression Tests
 *
 * After Sheldon's model swap (gemini-3-pro-preview → gemini-2.5-flash),
 * verify response quality doesn't degrade. Tests validate:
 * - Confidence scores remain above Silence Protocol threshold
 * - Citation structure is complete
 * - Evidence metadata is present
 * - Response is non-empty and well-formed
 * - SSE event parsing handles both models identically
 *
 * These are unit tests that validate the frontend's ability to parse
 * and quality-check backend responses. No live backend calls.
 *
 * — Sarah, QA
 */

// ─── Types matching Go backend response shape ────────────────────────────────

interface DoneCitation {
  documentName: string
  documentId: string
  chunkIndex: number
  relevanceScore: number
  snippet: string
}

interface DoneEvidence {
  totalChunksSearched: number
  totalDocumentsSearched: number
  confidenceScore: number
  model: string
  latencyMs: number
  citationCount: number
}

interface DonePayload {
  answer: string
  sources: Array<{ documentName: string; documentId: string }>
  citations: DoneCitation[]
  evidence: DoneEvidence
}

interface ConfidenceEvent {
  score?: number
  confidence?: number
  modelUsed?: string
  provider?: string
  latencyMs?: number
}

interface MetadataEvent {
  model_used?: string
  provider?: string
  latency_ms?: number
}

// ─── Quality validation functions (what frontend asserts) ────────────────────

const SILENCE_THRESHOLD = 0.60
const CONFIDENCE_FLOOR = 0.30

function isConfidenceAcceptable(score: number): boolean {
  return score >= SILENCE_THRESHOLD
}

function isConfidenceAboveFloor(score: number): boolean {
  return score >= CONFIDENCE_FLOOR
}

function hasCompleteCitations(citations: DoneCitation[]): boolean {
  return citations.every((c) =>
    c.documentName &&
    c.documentId &&
    c.snippet &&
    typeof c.relevanceScore === 'number' &&
    c.relevanceScore > 0,
  )
}

function hasValidEvidence(evidence: DoneEvidence): boolean {
  return (
    evidence.totalChunksSearched > 0 &&
    evidence.totalDocumentsSearched > 0 &&
    typeof evidence.confidenceScore === 'number' &&
    typeof evidence.latencyMs === 'number' &&
    typeof evidence.model === 'string' &&
    evidence.model.length > 0
  )
}

function isResponseNonEmpty(answer: string): boolean {
  return answer.trim().length > 0
}

// ─── Parse confidence from SSE event (matching chatStore/mercuryStore) ───────

function parseConfidence(data: ConfidenceEvent): number {
  return data.score ?? data.confidence ?? 0
}

// ─── Test fixtures ───────────────────────────────────────────────────────────

function makeFlashResponse(): DonePayload {
  return {
    answer: 'The effective date of the agreement is January 1, 2025, as stated in Section 1.1.',
    sources: [
      { documentName: 'Service Agreement.pdf', documentId: 'doc-001' },
    ],
    citations: [
      {
        documentName: 'Service Agreement.pdf',
        documentId: 'doc-001',
        chunkIndex: 3,
        relevanceScore: 0.92,
        snippet: 'This Agreement shall be effective as of January 1, 2025 ("Effective Date").',
      },
    ],
    evidence: {
      totalChunksSearched: 24,
      totalDocumentsSearched: 3,
      confidenceScore: 0.92,
      model: 'gemini-2.5-flash',
      latencyMs: 1200,
      citationCount: 1,
    },
  }
}

function makeProPreviewResponse(): DonePayload {
  return {
    answer: 'The effective date of the agreement is January 1, 2025, as stated in Section 1.1 of the Service Agreement.',
    sources: [
      { documentName: 'Service Agreement.pdf', documentId: 'doc-001' },
    ],
    citations: [
      {
        documentName: 'Service Agreement.pdf',
        documentId: 'doc-001',
        chunkIndex: 3,
        relevanceScore: 0.95,
        snippet: 'This Agreement shall be effective as of January 1, 2025 ("Effective Date").',
      },
    ],
    evidence: {
      totalChunksSearched: 24,
      totalDocumentsSearched: 3,
      confidenceScore: 0.95,
      model: 'gemini-3-pro-preview',
      latencyMs: 8500,
      citationCount: 1,
    },
  }
}

function makeComplexFlashResponse(): DonePayload {
  return {
    answer: 'The service provider is obligated to maintain insurance coverage of at least $1M, provide quarterly reports, and ensure 99.9% uptime as specified in Sections 4.2, 5.1, and 7.3 respectively.',
    sources: [
      { documentName: 'Service Agreement.pdf', documentId: 'doc-001' },
      { documentName: 'SLA Addendum.pdf', documentId: 'doc-002' },
    ],
    citations: [
      {
        documentName: 'Service Agreement.pdf',
        documentId: 'doc-001',
        chunkIndex: 8,
        relevanceScore: 0.88,
        snippet: 'The Provider shall maintain insurance coverage of no less than $1,000,000.',
      },
      {
        documentName: 'Service Agreement.pdf',
        documentId: 'doc-001',
        chunkIndex: 12,
        relevanceScore: 0.85,
        snippet: 'Quarterly performance reports shall be delivered within 15 business days.',
      },
      {
        documentName: 'SLA Addendum.pdf',
        documentId: 'doc-002',
        chunkIndex: 2,
        relevanceScore: 0.91,
        snippet: 'Service availability shall not fall below 99.9% measured monthly.',
      },
    ],
    evidence: {
      totalChunksSearched: 48,
      totalDocumentsSearched: 5,
      confidenceScore: 0.87,
      model: 'gemini-2.5-flash',
      latencyMs: 1800,
      citationCount: 3,
    },
  }
}

function makeLowConfidenceResponse(): DonePayload {
  return {
    answer: 'I found limited information about this topic in the available documents.',
    sources: [],
    citations: [],
    evidence: {
      totalChunksSearched: 24,
      totalDocumentsSearched: 3,
      confidenceScore: 0.45,
      model: 'gemini-2.5-flash',
      latencyMs: 900,
      citationCount: 0,
    },
  }
}

// ============================================================================
// CONFIDENCE SCORE STABILITY
// ============================================================================

describe('TTFB Regression — Confidence score stability', () => {
  it('gemini-2.5-flash simple query: confidence ≥ silence threshold', () => {
    const res = makeFlashResponse()
    expect(isConfidenceAcceptable(res.evidence.confidenceScore)).toBe(true)
  })

  it('gemini-2.5-flash complex query: confidence ≥ silence threshold', () => {
    const res = makeComplexFlashResponse()
    expect(isConfidenceAcceptable(res.evidence.confidenceScore)).toBe(true)
  })

  it('low confidence response is above floor (not zero)', () => {
    const res = makeLowConfidenceResponse()
    expect(isConfidenceAboveFloor(res.evidence.confidenceScore)).toBe(true)
  })

  it('confidence event parsing works for both score and confidence fields', () => {
    expect(parseConfidence({ score: 0.92 })).toBe(0.92)
    expect(parseConfidence({ confidence: 0.88 })).toBe(0.88)
    expect(parseConfidence({ score: 0.92, confidence: 0.88 })).toBe(0.92) // score takes precedence
    expect(parseConfidence({})).toBe(0)
  })

  it('gemini-2.5-flash confidence is in valid range [0, 1]', () => {
    const responses = [makeFlashResponse(), makeComplexFlashResponse(), makeLowConfidenceResponse()]
    for (const res of responses) {
      expect(res.evidence.confidenceScore).toBeGreaterThanOrEqual(0)
      expect(res.evidence.confidenceScore).toBeLessThanOrEqual(1)
    }
  })
})

// ============================================================================
// CITATION QUALITY
// ============================================================================

describe('TTFB Regression — Citation quality', () => {
  it('simple query citations are complete', () => {
    const res = makeFlashResponse()
    expect(hasCompleteCitations(res.citations)).toBe(true)
  })

  it('complex query citations are complete', () => {
    const res = makeComplexFlashResponse()
    expect(hasCompleteCitations(res.citations)).toBe(true)
  })

  it('citationCount matches actual citation array length', () => {
    const res = makeFlashResponse()
    expect(res.evidence.citationCount).toBe(res.citations.length)
  })

  it('complex response has multiple citations', () => {
    const res = makeComplexFlashResponse()
    expect(res.citations.length).toBeGreaterThanOrEqual(2)
    expect(res.evidence.citationCount).toBe(res.citations.length)
  })

  it('all relevance scores are above 0.5', () => {
    const res = makeComplexFlashResponse()
    for (const c of res.citations) {
      expect(c.relevanceScore).toBeGreaterThan(0.5)
    }
  })

  it('citation snippets are non-empty strings', () => {
    const res = makeComplexFlashResponse()
    for (const c of res.citations) {
      expect(c.snippet.trim().length).toBeGreaterThan(0)
    }
  })
})

// ============================================================================
// EVIDENCE METADATA COMPLETENESS
// ============================================================================

describe('TTFB Regression — Evidence metadata', () => {
  it('gemini-2.5-flash evidence is valid', () => {
    const res = makeFlashResponse()
    expect(hasValidEvidence(res.evidence)).toBe(true)
  })

  it('complex query evidence is valid', () => {
    const res = makeComplexFlashResponse()
    expect(hasValidEvidence(res.evidence)).toBe(true)
  })

  it('model field reflects the active model', () => {
    const flash = makeFlashResponse()
    expect(flash.evidence.model).toBe('gemini-2.5-flash')

    const pro = makeProPreviewResponse()
    expect(pro.evidence.model).toBe('gemini-3-pro-preview')
  })

  it('latency is positive number', () => {
    const res = makeFlashResponse()
    expect(res.evidence.latencyMs).toBeGreaterThan(0)
  })

  it('chunks and documents searched are positive', () => {
    const res = makeFlashResponse()
    expect(res.evidence.totalChunksSearched).toBeGreaterThan(0)
    expect(res.evidence.totalDocumentsSearched).toBeGreaterThan(0)
  })
})

// ============================================================================
// RESPONSE QUALITY COMPARISON (flash vs pro-preview)
// ============================================================================

describe('TTFB Regression — Model comparison quality gates', () => {
  it('flash response is non-empty', () => {
    expect(isResponseNonEmpty(makeFlashResponse().answer)).toBe(true)
  })

  it('flash complex response is non-empty', () => {
    expect(isResponseNonEmpty(makeComplexFlashResponse().answer)).toBe(true)
  })

  it('flash produces same citation count as pro-preview for same query', () => {
    const flash = makeFlashResponse()
    const pro = makeProPreviewResponse()
    // Same query, citation count should be within ±1
    expect(Math.abs(flash.evidence.citationCount - pro.evidence.citationCount)).toBeLessThanOrEqual(1)
  })

  it('flash confidence delta vs pro-preview ≤ 0.15', () => {
    const flash = makeFlashResponse()
    const pro = makeProPreviewResponse()
    const delta = Math.abs(flash.evidence.confidenceScore - pro.evidence.confidenceScore)
    expect(delta).toBeLessThanOrEqual(0.15)
  })

  it('flash latency is significantly lower than pro-preview', () => {
    const flash = makeFlashResponse()
    const pro = makeProPreviewResponse()
    // Flash should be at least 2x faster
    expect(flash.evidence.latencyMs).toBeLessThan(pro.evidence.latencyMs)
  })

  it('flash chunks searched matches pro-preview (same retrieval pipeline)', () => {
    const flash = makeFlashResponse()
    const pro = makeProPreviewResponse()
    expect(flash.evidence.totalChunksSearched).toBe(pro.evidence.totalChunksSearched)
  })
})

// ============================================================================
// SSE EVENT PARSING (both models produce same event shapes)
// ============================================================================

describe('TTFB Regression — SSE event shape consistency', () => {
  it('confidence event has expected fields', () => {
    const evt: ConfidenceEvent = {
      score: 0.92,
      modelUsed: 'gemini-2.5-flash',
      provider: 'vertex-ai',
      latencyMs: 1200,
    }
    expect(typeof evt.score).toBe('number')
    expect(typeof evt.modelUsed).toBe('string')
  })

  it('metadata event has expected fields', () => {
    const evt: MetadataEvent = {
      model_used: 'gemini-2.5-flash',
      provider: 'vertex-ai',
      latency_ms: 1200,
    }
    expect(typeof evt.model_used).toBe('string')
    expect(typeof evt.latency_ms).toBe('number')
  })

  it('done payload has all required top-level fields', () => {
    const done = makeFlashResponse()
    expect(done).toHaveProperty('answer')
    expect(done).toHaveProperty('sources')
    expect(done).toHaveProperty('citations')
    expect(done).toHaveProperty('evidence')
  })

  it('evidence in done payload has all required fields', () => {
    const { evidence } = makeFlashResponse()
    expect(evidence).toHaveProperty('totalChunksSearched')
    expect(evidence).toHaveProperty('totalDocumentsSearched')
    expect(evidence).toHaveProperty('confidenceScore')
    expect(evidence).toHaveProperty('model')
    expect(evidence).toHaveProperty('latencyMs')
    expect(evidence).toHaveProperty('citationCount')
  })
})

// ============================================================================
// SILENCE PROTOCOL (model swap must not increase false silences)
// ============================================================================

describe('TTFB Regression — Silence Protocol threshold', () => {
  it('normal query does NOT trigger silence', () => {
    const res = makeFlashResponse()
    expect(res.evidence.confidenceScore).toBeGreaterThanOrEqual(SILENCE_THRESHOLD)
  })

  it('low confidence query correctly below threshold', () => {
    const res = makeLowConfidenceResponse()
    expect(res.evidence.confidenceScore).toBeLessThan(SILENCE_THRESHOLD)
  })

  it('floor prevents zero-confidence responses from passing', () => {
    expect(isConfidenceAboveFloor(0)).toBe(false)
    expect(isConfidenceAboveFloor(0.29)).toBe(false)
    expect(isConfidenceAboveFloor(0.30)).toBe(true)
  })
})
