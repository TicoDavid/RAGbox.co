import { parseSSEText, parseSSEResponse } from '../sseParser'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Build an SSE frame: "event: <type>\ndata: <json>\n\n" */
function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/* ------------------------------------------------------------------ */
/*  parseSSEText                                                      */
/* ------------------------------------------------------------------ */

describe('parseSSEText', () => {
  // ------ 1. Token accumulation ------
  it('accumulates multiple token events into result.text', () => {
    const input =
      sse('token', { text: 'Hello' }) +
      sse('token', { text: ', world' }) +
      sse('token', { text: '!' })

    const result = parseSSEText(input)
    expect(result.text).toBe('Hello, world!')
    expect(result.isSilence).toBe(false)
    expect(result.confidence).toBeUndefined()
    expect(result.citations).toEqual([])
  })

  // ------ 2. Citations as top-level array ------
  it('parses citations when data is a top-level array', () => {
    const citations = [
      { citationIndex: 0, excerpt: 'Excerpt A', documentId: 'doc-1', documentName: 'Policy.pdf' },
      { citationIndex: 1, excerpt: 'Excerpt B', documentId: 'doc-2' },
    ]
    const input = sse('citations', citations)
    const result = parseSSEText(input)

    expect(result.citations).toHaveLength(2)
    expect(result.citations[0]).toEqual({
      index: 0,
      excerpt: 'Excerpt A',
      documentId: 'doc-1',
      documentName: 'Policy.pdf',
    })
    expect(result.citations[1]).toEqual({
      index: 1,
      excerpt: 'Excerpt B',
      documentId: 'doc-2',
      documentName: undefined,
    })
  })

  // ------ 3. Citations nested in an object ------
  it('parses citations nested inside { citations: [...] }', () => {
    const nested = {
      citations: [
        { index: 0, excerpt: 'Nested excerpt', documentId: 'doc-3', documentName: 'NDA.pdf' },
      ],
    }
    const input = sse('citations', nested)
    const result = parseSSEText(input)

    expect(result.citations).toEqual(nested.citations)
  })

  // ------ 4. Confidence via data.score ------
  it('extracts confidence from data.score', () => {
    const input = sse('confidence', { score: 0.92 })
    const result = parseSSEText(input)

    expect(result.confidence).toBe(0.92)
  })

  // ------ 5. Confidence via data.confidence ------
  it('extracts confidence from data.confidence when score is absent', () => {
    const input = sse('confidence', { confidence: 0.78 })
    const result = parseSSEText(input)

    expect(result.confidence).toBe(0.78)
  })

  // ------ 6. Silence event ------
  it('handles silence event (isSilence, message, suggestions)', () => {
    const input = sse('silence', {
      message: 'Insufficient data.',
      confidence: 0.3,
      suggestions: ['Try rephrasing', 'Upload more docs'],
    })
    const result = parseSSEText(input)

    expect(result.isSilence).toBe(true)
    expect(result.text).toBe('Insufficient data.')
    expect(result.confidence).toBe(0.3)
    expect(result.suggestions).toEqual(['Try rephrasing', 'Upload more docs'])
  })

  it('uses default silence message when data.message is absent', () => {
    const input = sse('silence', {})
    const result = parseSSEText(input)

    expect(result.isSilence).toBe(true)
    expect(result.text).toBe('Unable to provide a grounded answer.')
    expect(result.confidence).toBe(0)
    expect(result.suggestions).toBeUndefined()
  })

  // ------ 7. Status and done events are ignored ------
  it('ignores status and done events', () => {
    const input =
      sse('token', { text: 'answer' }) +
      sse('status', { phase: 'retrieving' }) +
      sse('done', { elapsed: 1234 })

    const result = parseSSEText(input)

    expect(result.text).toBe('answer')
    expect(result.confidence).toBeUndefined()
    expect(result.citations).toEqual([])
    expect(result.isSilence).toBe(false)
  })

  // ------ 8. Malformed JSON lines are skipped ------
  it('handles malformed JSON lines gracefully', () => {
    const input =
      'event: token\ndata: {not-valid-json}\n\n' +
      sse('token', { text: 'ok' })

    const result = parseSSEText(input)

    expect(result.text).toBe('ok')
  })

  // ------ 9. Default case: data.text fallback ------
  it('falls back to data.text when event type is unknown', () => {
    const input = sse('unknown_event', { text: 'fallback text' })
    const result = parseSSEText(input)

    expect(result.text).toBe('fallback text')
  })

  // ------ 10. Default case: data.score fallback ------
  it('falls back to data.score for confidence when event type is unknown', () => {
    const input = sse('unknown_event', { score: 0.55 })
    const result = parseSSEText(input)

    expect(result.confidence).toBe(0.55)
  })

  // ------ 11. Default case: data.message silence fallback ------
  it('falls back to data.message as silence when event type is unknown and no text yet', () => {
    const input = sse('unknown_event', { message: 'silence fallback' })
    const result = parseSSEText(input)

    expect(result.isSilence).toBe(true)
    expect(result.text).toBe('silence fallback')
  })

  it('does not treat data.message as silence when text already exists', () => {
    const input =
      sse('token', { text: 'existing' }) +
      sse('unknown_event', { message: 'should be ignored' })

    const result = parseSSEText(input)

    expect(result.isSilence).toBe(false)
    expect(result.text).toBe('existing')
  })

  // ------ 12. Empty input ------
  it('returns defaults for empty input', () => {
    const result = parseSSEText('')

    expect(result.text).toBe('')
    expect(result.confidence).toBeUndefined()
    expect(result.citations).toEqual([])
    expect(result.isSilence).toBe(false)
    expect(result.suggestions).toBeUndefined()
  })

  // ------ Edge cases ------
  it('handles token event with missing text field gracefully', () => {
    const input = sse('token', { other: 'field' })
    const result = parseSSEText(input)

    expect(result.text).toBe('')
  })

  it('handles citation array entries with missing fields', () => {
    const citations = [{ extra: 'value' }]
    const input = sse('citations', citations)
    const result = parseSSEText(input)

    expect(result.citations).toHaveLength(1)
    expect(result.citations[0]).toEqual({
      index: 0,
      excerpt: '',
      documentId: '',
      documentName: undefined,
    })
  })

  it('prefers data.score over data.confidence in the confidence event', () => {
    const input = sse('confidence', { score: 0.95, confidence: 0.80 })
    const result = parseSSEText(input)

    expect(result.confidence).toBe(0.95)
  })

  it('handles a full realistic SSE stream', () => {
    const input =
      sse('status', { phase: 'retrieving' }) +
      sse('token', { text: 'The policy states ' }) +
      sse('token', { text: 'that all employees must...' }) +
      sse('citations', [
        { citationIndex: 0, excerpt: 'all employees must...', documentId: 'doc-10', documentName: 'HR-Policy.pdf' },
      ]) +
      sse('confidence', { score: 0.94 }) +
      sse('done', { elapsed: 830 })

    const result = parseSSEText(input)

    expect(result.text).toBe('The policy states that all employees must...')
    expect(result.confidence).toBe(0.94)
    expect(result.citations).toHaveLength(1)
    expect(result.citations[0].documentName).toBe('HR-Policy.pdf')
    expect(result.isSilence).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  parseSSEResponse                                                  */
/* ------------------------------------------------------------------ */

describe('parseSSEResponse', () => {
  // ------ 13. Reads Response body and delegates to parseSSEText ------
  it('reads the Response body and delegates to parseSSEText', async () => {
    const body =
      sse('token', { text: 'async answer' }) +
      sse('confidence', { score: 0.88 })

    const mockResponse = {
      text: jest.fn().mockResolvedValue(body),
    } as unknown as Response

    const result = await parseSSEResponse(mockResponse)

    expect(mockResponse.text).toHaveBeenCalledTimes(1)
    expect(result.text).toBe('async answer')
    expect(result.confidence).toBe(0.88)
  })

  it('returns defaults when Response body is empty', async () => {
    const mockResponse = {
      text: jest.fn().mockResolvedValue(''),
    } as unknown as Response

    const result = await parseSSEResponse(mockResponse)

    expect(result.text).toBe('')
    expect(result.confidence).toBeUndefined()
    expect(result.citations).toEqual([])
    expect(result.isSilence).toBe(false)
  })
})
