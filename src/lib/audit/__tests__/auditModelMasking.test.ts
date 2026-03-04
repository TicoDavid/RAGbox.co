/**
 * STORY-231: Audit Model Metadata Masking Tests
 *
 * CPO ruling: Audit CSV/PDF exports must NOT leak raw model names.
 * - AEGIS routes → show "AEGIS"
 * - BYOLLM routes → show "Custom LLM"
 * - No model keys → details pass through unchanged
 *
 * Tests both the sanitizeModelMetadata() function and its integration
 * into mapPrismaToAuditEvent().
 *
 * — Sarah, QA
 */

import { sanitizeModelMetadata, mapPrismaToAuditEvent } from '../mappers'
import type { PrismaAuditRow } from '../mappers'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRow(details: Record<string, unknown>): PrismaAuditRow {
  return {
    id: 'evt-001',
    userId: 'user-abc',
    action: 'QUERY_RESPONSE',
    resourceId: null,
    severity: 'INFO',
    details,
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    entryHash: 'sha256-abc',
    createdAt: new Date('2026-03-03T12:00:00Z'),
  }
}

// ============================================================================
// sanitizeModelMetadata — unit tests
// ============================================================================

describe('STORY-231: sanitizeModelMetadata', () => {
  // ── AEGIS routes ────────────────────────────────────────────────────────

  it('replaces modelUsed with "AEGIS" for standard provider', () => {
    const result = sanitizeModelMetadata({
      query: 'test',
      modelUsed: 'gemini-2.5-flash',
      provider: 'vertex-ai',
    })
    expect(result.modelUsed).toBe('AEGIS')
    expect(result.provider).toBe('AEGIS')
  })

  it('replaces model key with "AEGIS" for standard provider', () => {
    const result = sanitizeModelMetadata({
      model: 'gpt-4o',
      provider: 'openai-proxy',
    })
    expect(result.model).toBe('AEGIS')
    expect(result.provider).toBe('AEGIS')
  })

  it('replaces all three keys simultaneously for AEGIS', () => {
    const result = sanitizeModelMetadata({
      model: 'gemini-pro',
      modelUsed: 'gemini-pro',
      provider: 'vertex',
    })
    expect(result.model).toBe('AEGIS')
    expect(result.modelUsed).toBe('AEGIS')
    expect(result.provider).toBe('AEGIS')
  })

  // ── BYOLLM routes ──────────────────────────────────────────────────────

  it('replaces modelUsed with "Custom LLM" for byollm provider', () => {
    const result = sanitizeModelMetadata({
      query: 'test',
      modelUsed: 'my-finetuned-llama-70b',
      provider: 'byollm',
    })
    expect(result.modelUsed).toBe('Custom LLM')
    expect(result.provider).toBe('Custom LLM')
  })

  it('replaces model with "Custom LLM" for custom provider', () => {
    const result = sanitizeModelMetadata({
      model: 'claude-3.5-sonnet',
      provider: 'custom',
    })
    expect(result.model).toBe('Custom LLM')
    expect(result.provider).toBe('Custom LLM')
  })

  it('treats BYOLLM case-insensitively', () => {
    const result = sanitizeModelMetadata({
      modelUsed: 'llama-70b',
      provider: 'BYOLLM',
    })
    expect(result.modelUsed).toBe('Custom LLM')
  })

  // ── No model keys → passthrough ────────────────────────────────────────

  it('passes through details with no model metadata keys', () => {
    const details = { query: 'hello', confidence: 0.92, documentCount: 3 }
    const result = sanitizeModelMetadata(details)
    expect(result).toEqual(details)
  })

  it('preserves non-model keys alongside masked values', () => {
    const result = sanitizeModelMetadata({
      query: 'what is RAG?',
      confidence: 0.95,
      modelUsed: 'gemini-2.5-flash',
      provider: 'vertex',
      documentCount: 5,
    })
    expect(result.query).toBe('what is RAG?')
    expect(result.confidence).toBe(0.95)
    expect(result.documentCount).toBe(5)
    expect(result.modelUsed).toBe('AEGIS')
  })

  it('handles empty details object', () => {
    const result = sanitizeModelMetadata({})
    expect(result).toEqual({})
  })

  // ── Edge cases ─────────────────────────────────────────────────────────

  it('defaults to AEGIS when provider key is absent but model key present', () => {
    const result = sanitizeModelMetadata({ modelUsed: 'gemini-pro' })
    expect(result.modelUsed).toBe('AEGIS')
  })

  it('defaults to AEGIS when provider is empty string', () => {
    const result = sanitizeModelMetadata({ model: 'gpt-4', provider: '' })
    expect(result.model).toBe('AEGIS')
    expect(result.provider).toBe('AEGIS')
  })

  it('does not mutate the input object', () => {
    const original = { model: 'gemini-pro', provider: 'vertex', query: 'hi' }
    const frozen = { ...original }
    sanitizeModelMetadata(original)
    expect(original).toEqual(frozen)
  })
})

// ============================================================================
// mapPrismaToAuditEvent — integration with sanitization
// ============================================================================

describe('STORY-231: mapPrismaToAuditEvent strips model metadata', () => {
  it('AEGIS model name is masked in mapped event details', () => {
    const row = makeRow({
      query: 'test query',
      modelUsed: 'gemini-2.5-flash',
      provider: 'vertex-ai',
    })
    const event = mapPrismaToAuditEvent(row)
    expect(event.details.modelUsed).toBe('AEGIS')
    expect(event.details.provider).toBe('AEGIS')
    expect(event.details.query).toBe('test query')
  })

  it('BYOLLM model name is masked in mapped event details', () => {
    const row = makeRow({
      query: 'test query',
      model: 'my-custom-llm',
      provider: 'byollm',
    })
    const event = mapPrismaToAuditEvent(row)
    expect(event.details.model).toBe('Custom LLM')
    expect(event.details.provider).toBe('Custom LLM')
  })

  it('event without model keys passes details through', () => {
    const row = makeRow({ query: 'hello', confidence: 0.9 })
    const event = mapPrismaToAuditEvent(row)
    expect(event.details).toEqual({ query: 'hello', confidence: 0.9 })
  })

  it('null details row produces empty details', () => {
    const row = makeRow({})
    row.details = null
    const event = mapPrismaToAuditEvent(row)
    expect(event.details).toEqual({})
  })

  it('preserves all other mapped fields', () => {
    const row = makeRow({ modelUsed: 'gemini-pro', provider: 'vertex' })
    const event = mapPrismaToAuditEvent(row)
    expect(event.id).toBe('evt-001')
    expect(event.eventId).toBe('evt-001')
    expect(event.userId).toBe('user-abc')
    expect(event.action).toBe('QUERY_RESPONSE')
    expect(event.severity).toBe('INFO')
    expect(event.hash).toBe('sha256-abc')
    expect(event.ipAddress).toBe('127.0.0.1')
  })
})

// ============================================================================
// CSV export integration — details JSON is sanitized
// ============================================================================

describe('STORY-231: CSV export receives sanitized details', () => {
  it('JSON.stringify of mapped details does not contain raw model names', () => {
    const row = makeRow({
      query: 'legal question',
      modelUsed: 'gemini-2.5-flash',
      provider: 'vertex-ai',
      confidence: 0.88,
    })
    const event = mapPrismaToAuditEvent(row)
    const json = JSON.stringify(event.details)
    expect(json).not.toContain('gemini-2.5-flash')
    expect(json).not.toContain('vertex-ai')
    expect(json).toContain('AEGIS')
    expect(json).toContain('legal question')
  })

  it('BYOLLM model name does not appear in serialized details', () => {
    const row = makeRow({
      model: 'llama-3-70b-instruct',
      provider: 'byollm',
    })
    const event = mapPrismaToAuditEvent(row)
    const json = JSON.stringify(event.details)
    expect(json).not.toContain('llama-3-70b-instruct')
    expect(json).toContain('Custom LLM')
  })
})
