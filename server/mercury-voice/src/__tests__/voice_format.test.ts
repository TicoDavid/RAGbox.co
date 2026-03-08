/**
 * Sarah — EPIC-028 Phase 3, Task 4: Voice response formatting tests
 */

import { stripForVoice } from '../ragbox_node'

describe('stripForVoice — markdown removal', () => {
  it('strips bold markdown', () => {
    const result = stripForVoice('This is **bold** text.')
    expect(result).toBe('This is bold text.')
  })

  it('strips italic markdown', () => {
    const result = stripForVoice('This is *italic* text.')
    expect(result).toBe('This is italic text.')
  })

  it('strips heading markers', () => {
    const result = stripForVoice('## Summary\nThe contract states the following.')
    expect(result).toContain('Summary')
    expect(result).not.toContain('##')
  })

  it('strips markdown links, keeps text', () => {
    const result = stripForVoice('See [the document](https://example.com) for details.')
    expect(result).toContain('the document')
    expect(result).not.toContain('https://')
    expect(result).not.toContain('[')
  })

  it('strips code blocks', () => {
    const result = stripForVoice('Here is code:\n```\nconsole.log("hi")\n```\nDone.')
    expect(result).not.toContain('```')
    expect(result).toContain('Done.')
  })

  it('strips inline code', () => {
    const result = stripForVoice('Use `npm install` to install.')
    expect(result).toBe('Use npm install to install.')
  })

  it('strips bullet points', () => {
    const result = stripForVoice('Items:\n- First item\n- Second item')
    expect(result).toContain('First item')
    expect(result).not.toMatch(/^[-*•]\s/)
  })

  it('strips numbered list markers', () => {
    const result = stripForVoice('Steps:\n1. Do this\n2. Do that')
    expect(result).toContain('Do this')
    expect(result).not.toMatch(/^\d+\./)
  })
})

describe('stripForVoice — citation removal', () => {
  it('removes citation markers [1], [2]', () => {
    const result = stripForVoice('The contract states [1] that the deadline is March 15 [2].')
    expect(result).not.toMatch(/\[\d+\]/)
    expect(result).toContain('The contract states')
    expect(result).toContain('March 15')
  })

  it('removes multiple adjacent citations', () => {
    const result = stripForVoice('According to sources [1][2][3], the finding is valid.')
    expect(result).not.toMatch(/\[\d+\]/)
  })
})

describe('stripForVoice — sentence cap', () => {
  it('caps at 3 sentences for voice mode', () => {
    const input = 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five.'
    const result = stripForVoice(input)
    const sentences = result.match(/[^.!?]*[.!?]+/g) || []
    expect(sentences.length).toBeLessThanOrEqual(3)
  })

  it('preserves all content if <= 3 sentences', () => {
    const input = 'First sentence. Second sentence. Third sentence.'
    const result = stripForVoice(input)
    expect(result).toContain('First sentence')
    expect(result).toContain('Third sentence')
  })

  it('handles sentences ending with ! or ?', () => {
    const input = 'Is this right? Yes it is! Here is the answer. More details follow. Extra.'
    const result = stripForVoice(input)
    const sentences = result.match(/[^.!?]*[.!?]+/g) || []
    expect(sentences.length).toBeLessThanOrEqual(3)
  })
})

describe('stripForVoice — sentence boundary detection', () => {
  it('correctly splits on period followed by space', () => {
    const input = 'Dr. Smith said hello. The meeting is at 3.30. Final statement.'
    const result = stripForVoice(input)
    // Should not crash or produce empty string
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns empty string for empty input', () => {
    expect(stripForVoice('')).toBe('')
  })

  it('handles input with only whitespace', () => {
    expect(stripForVoice('   ').trim()).toBe('')
  })
})

describe('stripForVoice — combined formatting', () => {
  it('handles real-world RAG response with citations + markdown + multiple sentences', () => {
    const input = `## Key Findings

According to **Section 3.2** [1], the contract states:

- The renewal date is April 15, 2026
- Failure to renew results in termination [2]

The [compliance report](https://internal.link) recommends early action [3]. Additionally, the financial terms require review. A further analysis is recommended. Extra detail here.`

    const result = stripForVoice(input)

    // No markdown
    expect(result).not.toMatch(/\*\*/)
    expect(result).not.toContain('##')
    // No citations
    expect(result).not.toMatch(/\[\d+\]/)
    // No URLs
    expect(result).not.toContain('https://')
    // <= 3 sentences
    const sentences = result.match(/[^.!?]*[.!?]+/g) || []
    expect(sentences.length).toBeLessThanOrEqual(3)
    // Still has meaningful content
    expect(result.length).toBeGreaterThan(20)
  })
})
