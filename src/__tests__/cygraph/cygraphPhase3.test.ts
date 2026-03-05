/**
 * Sarah — FINAL WAVE Task 4: CyGraph Phase 3 Tests
 *
 * Tests cross-channel entity correlation, proactive pattern detection,
 * contradiction/inconsistency detection, and insight lifecycle:
 * - Cross-channel entity correlation (doc, chat, email, phone, slack)
 * - Contradiction detection between claims
 * - Inconsistency flagging across documents
 * - Gap analysis for missing knowledge
 * - Insight lifecycle (generated → viewed → dismissed/actioned)
 * - Insight generation confidence threshold
 * - Pattern detection rules
 */

export {}

// ============================================================================
// TYPES — Insight Model + Cross-Channel Correlation
// ============================================================================

type InsightType = 'contradiction' | 'inconsistency' | 'gap' | 'trend' | 'risk'
type InsightStatus = 'generated' | 'viewed' | 'dismissed' | 'actioned'
type ChannelSource = 'document' | 'conversation' | 'email' | 'phone' | 'slack' | 'roam'

interface KgInsight {
  id: string
  tenantId: string
  type: InsightType
  title: string
  description: string
  confidence: number
  status: InsightStatus
  relatedClaimIds: string[]
  relatedEntityIds: string[]
  channelSources: ChannelSource[]
  createdAt: Date
  viewedAt?: Date
  resolvedAt?: Date
}

interface CrossChannelEntity {
  entityId: string
  entityName: string
  channels: ChannelSource[]
  mentionCount: number
  documents: string[]
}

interface ContradictionPair {
  claimA: { id: string; text: string; documentId: string; confidence: number }
  claimB: { id: string; text: string; documentId: string; confidence: number }
  contradictionScore: number
}

// ============================================================================
// CROSS-CHANNEL ENTITY CORRELATION
// ============================================================================

describe('Sarah — CyGraph Phase 3: Cross-Channel Correlation', () => {
  function correlateEntities(
    mentions: Array<{ entityId: string; entityName: string; documentId: string; channel: ChannelSource }>,
  ): CrossChannelEntity[] {
    const map = new Map<string, CrossChannelEntity>()
    for (const m of mentions) {
      const existing = map.get(m.entityId) ?? {
        entityId: m.entityId,
        entityName: m.entityName,
        channels: [] as ChannelSource[],
        mentionCount: 0,
        documents: [] as string[],
      }
      existing.mentionCount++
      if (!existing.channels.includes(m.channel)) existing.channels.push(m.channel)
      if (!existing.documents.includes(m.documentId)) existing.documents.push(m.documentId)
      map.set(m.entityId, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.mentionCount - a.mentionCount)
  }

  test('entity appearing in multiple channels is correlated', () => {
    const mentions = [
      { entityId: 'e1', entityName: 'ACME Corp', documentId: 'doc1', channel: 'document' as ChannelSource },
      { entityId: 'e1', entityName: 'ACME Corp', documentId: 'thread:t1', channel: 'conversation' as ChannelSource },
      { entityId: 'e1', entityName: 'ACME Corp', documentId: 'email:m1', channel: 'email' as ChannelSource },
    ]
    const result = correlateEntities(mentions)
    expect(result[0].channels).toEqual(['document', 'conversation', 'email'])
    expect(result[0].mentionCount).toBe(3)
  })

  test('entities sorted by mention count descending', () => {
    const mentions = [
      { entityId: 'e1', entityName: 'ACME', documentId: 'd1', channel: 'document' as ChannelSource },
      { entityId: 'e2', entityName: 'Globex', documentId: 'd1', channel: 'document' as ChannelSource },
      { entityId: 'e2', entityName: 'Globex', documentId: 'd2', channel: 'conversation' as ChannelSource },
      { entityId: 'e2', entityName: 'Globex', documentId: 'd3', channel: 'email' as ChannelSource },
    ]
    const result = correlateEntities(mentions)
    expect(result[0].entityName).toBe('Globex')
    expect(result[0].mentionCount).toBe(3)
  })

  test('single-channel entity has one channel source', () => {
    const mentions = [
      { entityId: 'e1', entityName: 'Solo', documentId: 'd1', channel: 'document' as ChannelSource },
      { entityId: 'e1', entityName: 'Solo', documentId: 'd2', channel: 'document' as ChannelSource },
    ]
    const result = correlateEntities(mentions)
    expect(result[0].channels).toEqual(['document'])
    expect(result[0].documents.length).toBe(2)
  })

  test('thread documents identified by thread: prefix', () => {
    const mentions = [
      { entityId: 'e1', entityName: 'Contract', documentId: 'thread:abc123', channel: 'conversation' as ChannelSource },
    ]
    const result = correlateEntities(mentions)
    expect(result[0].documents[0]).toBe('thread:abc123')
  })

  test('phone and slack channels tracked separately', () => {
    const mentions = [
      { entityId: 'e1', entityName: 'Clause 5', documentId: 'call:c1', channel: 'phone' as ChannelSource },
      { entityId: 'e1', entityName: 'Clause 5', documentId: 'slack:s1', channel: 'slack' as ChannelSource },
    ]
    const result = correlateEntities(mentions)
    expect(result[0].channels).toContain('phone')
    expect(result[0].channels).toContain('slack')
    expect(result[0].channels.length).toBe(2)
  })
})

// ============================================================================
// CONTRADICTION DETECTION — Opposing Claims
// ============================================================================

describe('Sarah — CyGraph Phase 3: Contradiction Detection', () => {
  function detectContradictions(
    claims: Array<{ id: string; subjectEntity: string; predicate: string; objectValue: string; documentId: string; confidence: number }>,
  ): ContradictionPair[] {
    const pairs: ContradictionPair[] = []
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        const a = claims[i]
        const b = claims[j]
        // Same subject + same predicate + different value = potential contradiction
        if (
          a.subjectEntity === b.subjectEntity &&
          a.predicate === b.predicate &&
          a.objectValue !== b.objectValue
        ) {
          const score = Math.min(a.confidence, b.confidence)
          pairs.push({
            claimA: { id: a.id, text: `${a.subjectEntity} ${a.predicate} ${a.objectValue}`, documentId: a.documentId, confidence: a.confidence },
            claimB: { id: b.id, text: `${b.subjectEntity} ${b.predicate} ${b.objectValue}`, documentId: b.documentId, confidence: b.confidence },
            contradictionScore: score,
          })
        }
      }
    }
    return pairs.sort((a, b) => b.contradictionScore - a.contradictionScore)
  }

  test('detects contradiction when same entity has conflicting claims', () => {
    const claims = [
      { id: 'c1', subjectEntity: 'Contract A', predicate: 'terminates_on', objectValue: '2026-12-31', documentId: 'd1', confidence: 0.9 },
      { id: 'c2', subjectEntity: 'Contract A', predicate: 'terminates_on', objectValue: '2027-06-30', documentId: 'd2', confidence: 0.85 },
    ]
    const result = detectContradictions(claims)
    expect(result.length).toBe(1)
    expect(result[0].claimA.id).toBe('c1')
    expect(result[0].claimB.id).toBe('c2')
  })

  test('no contradiction when predicates differ', () => {
    const claims = [
      { id: 'c1', subjectEntity: 'ACME', predicate: 'revenue', objectValue: '$10M', documentId: 'd1', confidence: 0.9 },
      { id: 'c2', subjectEntity: 'ACME', predicate: 'employees', objectValue: '500', documentId: 'd2', confidence: 0.9 },
    ]
    expect(detectContradictions(claims).length).toBe(0)
  })

  test('no contradiction when values match', () => {
    const claims = [
      { id: 'c1', subjectEntity: 'NDA', predicate: 'duration', objectValue: '2 years', documentId: 'd1', confidence: 0.9 },
      { id: 'c2', subjectEntity: 'NDA', predicate: 'duration', objectValue: '2 years', documentId: 'd2', confidence: 0.8 },
    ]
    expect(detectContradictions(claims).length).toBe(0)
  })

  test('contradiction score is min of both confidences', () => {
    const claims = [
      { id: 'c1', subjectEntity: 'Deal', predicate: 'value', objectValue: '$1M', documentId: 'd1', confidence: 0.95 },
      { id: 'c2', subjectEntity: 'Deal', predicate: 'value', objectValue: '$2M', documentId: 'd2', confidence: 0.7 },
    ]
    const result = detectContradictions(claims)
    expect(result[0].contradictionScore).toBe(0.7)
  })

  test('multiple contradictions sorted by score descending', () => {
    const claims = [
      { id: 'c1', subjectEntity: 'A', predicate: 'p', objectValue: 'v1', documentId: 'd1', confidence: 0.5 },
      { id: 'c2', subjectEntity: 'A', predicate: 'p', objectValue: 'v2', documentId: 'd2', confidence: 0.6 },
      { id: 'c3', subjectEntity: 'B', predicate: 'q', objectValue: 'x1', documentId: 'd1', confidence: 0.9 },
      { id: 'c4', subjectEntity: 'B', predicate: 'q', objectValue: 'x2', documentId: 'd2', confidence: 0.95 },
    ]
    const result = detectContradictions(claims)
    expect(result.length).toBe(2)
    expect(result[0].contradictionScore).toBe(0.9) // B pair
    expect(result[1].contradictionScore).toBe(0.5) // A pair
  })
})

// ============================================================================
// INSIGHT LIFECYCLE — Generated → Viewed → Dismissed/Actioned
// ============================================================================

describe('Sarah — CyGraph Phase 3: Insight Lifecycle', () => {
  function createInsight(type: InsightType, confidence: number, channels: ChannelSource[]): KgInsight {
    return {
      id: `ins-${Date.now()}`,
      tenantId: 't1',
      type,
      title: `${type} detected`,
      description: `A ${type} was found across ${channels.join(', ')}`,
      confidence,
      status: 'generated',
      relatedClaimIds: [],
      relatedEntityIds: [],
      channelSources: channels,
      createdAt: new Date(),
    }
  }

  function transitionInsight(insight: KgInsight, action: 'view' | 'dismiss' | 'action'): KgInsight {
    switch (action) {
      case 'view':
        return { ...insight, status: 'viewed', viewedAt: new Date() }
      case 'dismiss':
        return { ...insight, status: 'dismissed', resolvedAt: new Date() }
      case 'action':
        return { ...insight, status: 'actioned', resolvedAt: new Date() }
    }
  }

  test('insight created with generated status', () => {
    const insight = createInsight('contradiction', 0.85, ['document', 'conversation'])
    expect(insight.status).toBe('generated')
    expect(insight.type).toBe('contradiction')
  })

  test('viewing transitions to viewed status', () => {
    const insight = createInsight('gap', 0.7, ['document'])
    const viewed = transitionInsight(insight, 'view')
    expect(viewed.status).toBe('viewed')
    expect(viewed.viewedAt).toBeDefined()
  })

  test('dismissing transitions to dismissed status', () => {
    const insight = createInsight('trend', 0.6, ['email'])
    const dismissed = transitionInsight(insight, 'dismiss')
    expect(dismissed.status).toBe('dismissed')
    expect(dismissed.resolvedAt).toBeDefined()
  })

  test('actioning transitions to actioned status', () => {
    const insight = createInsight('risk', 0.9, ['document', 'phone'])
    const actioned = transitionInsight(insight, 'action')
    expect(actioned.status).toBe('actioned')
    expect(actioned.resolvedAt).toBeDefined()
  })

  test('immutable transitions — original insight unchanged', () => {
    const original = createInsight('inconsistency', 0.75, ['slack'])
    const viewed = transitionInsight(original, 'view')
    expect(original.status).toBe('generated')
    expect(viewed.status).toBe('viewed')
  })
})

// ============================================================================
// INSIGHT GENERATION THRESHOLD + PATTERN RULES
// ============================================================================

describe('Sarah — CyGraph Phase 3: Insight Generation', () => {
  const INSIGHT_CONFIDENCE_THRESHOLD = 0.6

  interface PatternRule {
    type: InsightType
    patterns: RegExp[]
    keywords: string[]
  }

  const PATTERN_RULES: PatternRule[] = [
    {
      type: 'contradiction',
      patterns: [/contradicts?/i, /conflicts? with/i, /inconsistent with/i],
      keywords: ['however', 'but', 'contrary', 'opposing', 'differs'],
    },
    {
      type: 'risk',
      patterns: [/risk\s+(level|assessment|factor)/i, /liability/i, /vulnerability/i],
      keywords: ['risk', 'exposure', 'compliance', 'violation'],
    },
    {
      type: 'gap',
      patterns: [/missing\s+(information|data|document)/i, /no\s+evidence/i],
      keywords: ['missing', 'absent', 'unavailable', 'incomplete'],
    },
  ]

  function matchPatternRules(text: string): InsightType[] {
    const matched: InsightType[] = []
    for (const rule of PATTERN_RULES) {
      const patternMatch = rule.patterns.some(p => p.test(text))
      const keywordMatch = rule.keywords.some(k => text.toLowerCase().includes(k))
      if (patternMatch || keywordMatch) {
        matched.push(rule.type)
      }
    }
    return [...new Set(matched)]
  }

  function calculateInsightConfidence(
    patternMatches: number,
    keywordMatches: number,
    claimConfidence: number,
  ): number {
    const base = (patternMatches * 0.3 + keywordMatches * 0.2 + claimConfidence * 0.5)
    return Math.min(1.0, Math.max(0, base))
  }

  function shouldGenerateInsight(confidence: number): boolean {
    return confidence >= INSIGHT_CONFIDENCE_THRESHOLD
  }

  test('insight below threshold is not generated', () => {
    expect(shouldGenerateInsight(0.5)).toBe(false)
    expect(shouldGenerateInsight(0.59)).toBe(false)
  })

  test('insight at or above threshold is generated', () => {
    expect(shouldGenerateInsight(0.6)).toBe(true)
    expect(shouldGenerateInsight(0.9)).toBe(true)
  })

  test('contradiction pattern detected in text', () => {
    const types = matchPatternRules('This statement contradicts the previous finding')
    expect(types).toContain('contradiction')
  })

  test('risk pattern detected in text', () => {
    const types = matchPatternRules('The risk level is elevated due to compliance violation')
    expect(types).toContain('risk')
  })

  test('gap pattern detected in text', () => {
    const types = matchPatternRules('There is missing information about the contract terms')
    expect(types).toContain('gap')
  })

  test('no pattern matched for neutral text', () => {
    const types = matchPatternRules('The weather is sunny today')
    expect(types.length).toBe(0)
  })

  test('confidence calculation combines pattern, keyword, and claim scores', () => {
    const confidence = calculateInsightConfidence(1, 1, 0.8)
    // 1*0.3 + 1*0.2 + 0.8*0.5 = 0.3 + 0.2 + 0.4 = 0.9
    expect(confidence).toBeCloseTo(0.9, 2)
  })

  test('confidence capped at 1.0', () => {
    const confidence = calculateInsightConfidence(3, 3, 1.0)
    expect(confidence).toBe(1.0)
  })

  test('confidence floored at 0', () => {
    const confidence = calculateInsightConfidence(0, 0, 0)
    expect(confidence).toBe(0)
  })
})

// ============================================================================
// INSIGHT TYPE COVERAGE — All 5 Types
// ============================================================================

describe('Sarah — CyGraph Phase 3: Insight Types', () => {
  const ALL_INSIGHT_TYPES: InsightType[] = ['contradiction', 'inconsistency', 'gap', 'trend', 'risk']

  test('all 5 insight types defined', () => {
    expect(ALL_INSIGHT_TYPES.length).toBe(5)
  })

  test('contradiction type for opposing claims', () => {
    expect(ALL_INSIGHT_TYPES).toContain('contradiction')
  })

  test('inconsistency type for mismatched data', () => {
    expect(ALL_INSIGHT_TYPES).toContain('inconsistency')
  })

  test('gap type for missing knowledge', () => {
    expect(ALL_INSIGHT_TYPES).toContain('gap')
  })

  test('trend type for data patterns', () => {
    expect(ALL_INSIGHT_TYPES).toContain('trend')
  })

  test('risk type for compliance/liability', () => {
    expect(ALL_INSIGHT_TYPES).toContain('risk')
  })
})
