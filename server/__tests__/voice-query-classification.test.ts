/**
 * Voice Query Classification Tests (Task 3 — Two-Mode Query)
 *
 * Tests for Sheldon's conversational vs. document query classifier.
 * When Sheldon implements classification, these stubs become real tests.
 *
 * Expected behavior:
 *   classifyQuery("Hello") → "conversational"
 *   classifyQuery("What's in my NDA?") → "document"
 *
 * Conversational queries get natural responses (no RAG retrieval).
 * Document queries go through the full RAG pipeline with citations.
 *
 * — Sarah, QA
 */

// ─── Placeholder for Sheldon's classifier ────────────────────────────────────
// Once implemented, replace with:
//   import { classifyQuery } from '../voice-pipeline-v3'
//
// Expected interface:
//   type QueryType = 'conversational' | 'document'
//   function classifyQuery(text: string): QueryType

// ============================================================================
// CONVERSATIONAL QUERIES — no RAG retrieval needed
// ============================================================================

describe('Query Classification — Conversational', () => {

  it.todo('"Hello" classified as conversational')

  it.todo('"Thank you" classified as conversational')

  it.todo('"Goodbye" classified as conversational')

  it.todo('"How are you?" classified as conversational')

  it.todo('"Good morning" classified as conversational')
})

// ============================================================================
// DOCUMENT QUERIES — full RAG pipeline
// ============================================================================

describe('Query Classification — Document Query', () => {

  it.todo('"What\'s in my NDA?" classified as document query')

  it.todo('"Summarize the agreement" classified as document query')

  it.todo('"Find the termination clause" classified as document query')

  it.todo('"What does section 4 say?" classified as document query')

  it.todo('"Show me the contract details" classified as document query')
})

// ============================================================================
// EDGE CASES — intent wins over greeting
// ============================================================================

describe('Query Classification — Edge Cases', () => {

  it.todo('"Hello, can you find my document?" → document query (intent wins)')

  it.todo('"Thanks, now summarize the lease" → document query (intent wins)')

  it.todo('"Hey, what does my NDA say about non-compete?" → document query')

  it.todo('empty string → conversational (safe default)')

  it.todo('whitespace-only → conversational (safe default)')
})
