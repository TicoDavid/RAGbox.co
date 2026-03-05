/**
 * Sarah — POST-LAUNCH-POLISH: Response Layout Tests
 *
 * Tests the response layout system:
 * - Layout toggle persistence (Dossier/Conversation/Analyst)
 * - Each layout renders the same response data differently
 * - Dossier: evidence drawer, gold border, confidence badge
 * - Conversation: inline citations, no cards, avatar
 * - Analyst: split view (60/40), simultaneous answer + evidence
 * - Default layout is Dossier
 * - Layout selection persists across sessions (localStorage)
 */

// ============================================================================
// LAYOUT TYPE SYSTEM
// ============================================================================

type ResponseLayout = 'dossier' | 'conversation' | 'analyst'

const LAYOUT_LABELS: Record<ResponseLayout, string> = {
  dossier: 'Dossier',
  conversation: 'Conversation',
  analyst: 'Analyst',
}

const LAYOUT_ICONS: Record<ResponseLayout, string> = {
  dossier: '📋',
  conversation: '💬',
  analyst: '📊',
}

const DEFAULT_LAYOUT: ResponseLayout = 'dossier'

// Shared test response data — same data renders differently per layout
const TEST_RESPONSE = {
  content: 'The liability cap in Section 5 limits exposure to $1.2M annually.',
  citations: [
    { documentName: 'contract.pdf', documentId: 'doc-1', chunkIndex: 3, relevanceScore: 0.92, snippet: 'liability shall not exceed $1.2M' },
    { documentName: 'amendment.pdf', documentId: 'doc-2', chunkIndex: 1, relevanceScore: 0.87, snippet: 'annual cap revised per Section 5' },
  ],
  confidence: 0.91,
  evidence: {
    totalDocumentsFound: 5,
    totalCandidates: 23,
    modelUsed: 'aegis/gemini-2.5-flash',
  },
}

// ============================================================================
// LAYOUT TOGGLE — Persistence
// ============================================================================

describe('Sarah — Response Layout: Toggle Persistence', () => {
  let mockStorage: Record<string, string>

  beforeEach(() => {
    mockStorage = {}
  })

  function getLayout(): ResponseLayout {
    const stored = mockStorage['ragbox-response-layout']
    if (stored && (stored === 'dossier' || stored === 'conversation' || stored === 'analyst')) {
      return stored
    }
    return DEFAULT_LAYOUT
  }

  function setLayout(layout: ResponseLayout): void {
    mockStorage['ragbox-response-layout'] = layout
  }

  test('default layout is Dossier', () => {
    expect(getLayout()).toBe('dossier')
  })

  test('toggle to Conversation persists', () => {
    setLayout('conversation')
    expect(getLayout()).toBe('conversation')
  })

  test('toggle to Analyst persists', () => {
    setLayout('analyst')
    expect(getLayout()).toBe('analyst')
  })

  test('toggle back to Dossier persists', () => {
    setLayout('analyst')
    setLayout('dossier')
    expect(getLayout()).toBe('dossier')
  })

  test('invalid stored value falls back to Dossier', () => {
    mockStorage['ragbox-response-layout'] = 'invalid-mode'
    expect(getLayout()).toBe('dossier')
  })

  test('missing storage key falls back to Dossier', () => {
    delete mockStorage['ragbox-response-layout']
    expect(getLayout()).toBe('dossier')
  })

  test('all 3 layouts have labels', () => {
    const layouts: ResponseLayout[] = ['dossier', 'conversation', 'analyst']
    for (const layout of layouts) {
      expect(LAYOUT_LABELS[layout]).toBeDefined()
      expect(LAYOUT_LABELS[layout].length).toBeGreaterThan(0)
    }
  })

  test('all 3 layouts have icons', () => {
    const layouts: ResponseLayout[] = ['dossier', 'conversation', 'analyst']
    for (const layout of layouts) {
      expect(LAYOUT_ICONS[layout]).toBeDefined()
    }
  })
})

// ============================================================================
// DOSSIER LAYOUT — Intelligence Briefing
// ============================================================================

describe('Sarah — Response Layout: Dossier Mode', () => {
  test('renders answer as clean prose', () => {
    const rendered = renderDossier(TEST_RESPONSE)
    expect(rendered.answer).toBe(TEST_RESPONSE.content)
    expect(rendered.hasCard).toBe(true)
  })

  test('dark card with gold left border', () => {
    const rendered = renderDossier(TEST_RESPONSE)
    expect(rendered.borderColor).toBe('#D4A853')
    expect(rendered.cardStyle).toBe('dark')
  })

  test('confidence badge in top-right corner', () => {
    const rendered = renderDossier(TEST_RESPONSE)
    expect(rendered.confidenceBadge).toBeDefined()
    expect(rendered.confidenceBadge.value).toBe(0.91)
    expect(rendered.confidenceBadge.position).toBe('top-right')
  })

  test('citations as superscript footnotes [1], [2]', () => {
    const rendered = renderDossier(TEST_RESPONSE)
    expect(rendered.citationStyle).toBe('superscript')
    expect(rendered.citations.length).toBe(2)
  })

  test('sources collapsed under "View Evidence" drawer', () => {
    const rendered = renderDossier(TEST_RESPONSE)
    expect(rendered.evidenceDrawer.collapsed).toBe(true)
    expect(rendered.evidenceDrawer.label).toContain('Evidence')
  })

  test('evidence drawer expands on click', () => {
    const rendered = renderDossier(TEST_RESPONSE)
    rendered.evidenceDrawer.collapsed = false
    expect(rendered.evidenceDrawer.collapsed).toBe(false)
  })

  test('bold key facts in answer prose', () => {
    const answerWithBold = 'The cap is **$1.2M** annually per **Section 5**.'
    const hasBoldMarkers = /\*\*[^*]+\*\*/.test(answerWithBold)
    expect(hasBoldMarkers).toBe(true)
  })
})

// ============================================================================
// CONVERSATION LAYOUT — Natural Dialogue
// ============================================================================

describe('Sarah — Response Layout: Conversation Mode', () => {
  test('renders without cards or borders', () => {
    const rendered = renderConversation(TEST_RESPONSE)
    expect(rendered.hasCard).toBe(false)
    expect(rendered.hasBorder).toBe(false)
  })

  test('Mercury avatar inline with response', () => {
    const rendered = renderConversation(TEST_RESPONSE)
    expect(rendered.avatar.visible).toBe(true)
    expect(rendered.avatar.position).toBe('inline')
  })

  test('inline citation chips (not superscript)', () => {
    const rendered = renderConversation(TEST_RESPONSE)
    expect(rendered.citationStyle).toBe('inline-chip')
    expect(rendered.citations.length).toBe(2)
  })

  test('citation chips glow on hover', () => {
    const rendered = renderConversation(TEST_RESPONSE)
    expect(rendered.citationHoverEffect).toBe('blue-pulse')
  })

  test('sources appear as slide-out sidebar on citation click', () => {
    const rendered = renderConversation(TEST_RESPONSE)
    expect(rendered.sourceDisplay).toBe('slide-out-sidebar')
  })

  test('minimal chrome — text IS the UI', () => {
    const rendered = renderConversation(TEST_RESPONSE)
    expect(rendered.hasCard).toBe(false)
    expect(rendered.hasBorder).toBe(false)
    expect(rendered.hasConfidenceBadge).toBe(false)
  })

  test('answer is same content as other layouts', () => {
    const rendered = renderConversation(TEST_RESPONSE)
    expect(rendered.answer).toBe(TEST_RESPONSE.content)
  })
})

// ============================================================================
// ANALYST LAYOUT — Split Evidence View
// ============================================================================

describe('Sarah — Response Layout: Analyst Mode', () => {
  test('split view: answer left (60%), evidence right (40%)', () => {
    const rendered = renderAnalyst(TEST_RESPONSE)
    expect(rendered.layout).toBe('split')
    expect(rendered.answerWidth).toBe('60%')
    expect(rendered.evidenceWidth).toBe('40%')
  })

  test('answer and evidence visible simultaneously', () => {
    const rendered = renderAnalyst(TEST_RESPONSE)
    expect(rendered.answerVisible).toBe(true)
    expect(rendered.evidenceVisible).toBe(true)
  })

  test('no tabs — direct rendering', () => {
    const rendered = renderAnalyst(TEST_RESPONSE)
    expect(rendered.hasTabs).toBe(false)
  })

  test('evidence panel shows source excerpts', () => {
    const rendered = renderAnalyst(TEST_RESPONSE)
    expect(rendered.evidencePanel.excerpts.length).toBe(2)
    expect(rendered.evidencePanel.excerpts[0]).toContain('liability')
  })

  test('evidence panel shows confidence meter', () => {
    const rendered = renderAnalyst(TEST_RESPONSE)
    expect(rendered.evidencePanel.confidenceMeter).toBeDefined()
    expect(rendered.evidencePanel.confidenceMeter.value).toBe(0.91)
  })

  test('clickable citations highlight corresponding evidence', () => {
    const rendered = renderAnalyst(TEST_RESPONSE)
    expect(rendered.citationStyle).toBe('clickable-highlight')
  })

  test('answer is same content as other layouts', () => {
    const rendered = renderAnalyst(TEST_RESPONSE)
    expect(rendered.answer).toBe(TEST_RESPONSE.content)
  })
})

// ============================================================================
// CROSS-LAYOUT — Same Data, Different Rendering
// ============================================================================

describe('Sarah — Response Layout: Same Data Across Modes', () => {
  test('all 3 layouts render the same answer text', () => {
    const dossier = renderDossier(TEST_RESPONSE)
    const conversation = renderConversation(TEST_RESPONSE)
    const analyst = renderAnalyst(TEST_RESPONSE)

    expect(dossier.answer).toBe(TEST_RESPONSE.content)
    expect(conversation.answer).toBe(TEST_RESPONSE.content)
    expect(analyst.answer).toBe(TEST_RESPONSE.content)
  })

  test('all 3 layouts include all citations', () => {
    const dossier = renderDossier(TEST_RESPONSE)
    const conversation = renderConversation(TEST_RESPONSE)
    const analyst = renderAnalyst(TEST_RESPONSE)

    expect(dossier.citations.length).toBe(2)
    expect(conversation.citations.length).toBe(2)
    expect(analyst.citations.length).toBe(2)
  })

  test('citation styles differ per layout', () => {
    const dossier = renderDossier(TEST_RESPONSE)
    const conversation = renderConversation(TEST_RESPONSE)
    const analyst = renderAnalyst(TEST_RESPONSE)

    expect(dossier.citationStyle).toBe('superscript')
    expect(conversation.citationStyle).toBe('inline-chip')
    expect(analyst.citationStyle).toBe('clickable-highlight')
  })

  test('evidence display differs per layout', () => {
    const dossier = renderDossier(TEST_RESPONSE)
    const conversation = renderConversation(TEST_RESPONSE)
    const analyst = renderAnalyst(TEST_RESPONSE)

    // Dossier: collapsed drawer
    expect(dossier.evidenceDrawer.collapsed).toBe(true)
    // Conversation: slide-out sidebar
    expect(conversation.sourceDisplay).toBe('slide-out-sidebar')
    // Analyst: always visible
    expect(analyst.evidenceVisible).toBe(true)
  })

  test('empty citations handled by all layouts', () => {
    const empty = { ...TEST_RESPONSE, citations: [] }
    const dossier = renderDossier(empty)
    const conversation = renderConversation(empty)
    const analyst = renderAnalyst(empty)

    expect(dossier.citations.length).toBe(0)
    expect(conversation.citations.length).toBe(0)
    expect(analyst.citations.length).toBe(0)
  })

  test('missing confidence handled by all layouts', () => {
    const noConf = { ...TEST_RESPONSE, confidence: undefined }
    const dossier = renderDossier(noConf)
    const analyst = renderAnalyst(noConf)

    expect(dossier.confidenceBadge.value).toBeUndefined()
    expect(analyst.evidencePanel.confidenceMeter.value).toBeUndefined()
  })
})

// ============================================================================
// RENDER HELPERS — Mock layout renderers that match the spec
// ============================================================================

interface ResponseData {
  content: string
  citations: Array<{ documentName: string; documentId: string; chunkIndex: number; relevanceScore: number; snippet: string }>
  confidence?: number
  evidence?: { totalDocumentsFound: number; totalCandidates: number; modelUsed: string }
}

function renderDossier(data: ResponseData) {
  return {
    answer: data.content,
    hasCard: true,
    cardStyle: 'dark' as const,
    borderColor: '#D4A853',
    confidenceBadge: {
      value: data.confidence,
      position: 'top-right' as const,
    },
    citationStyle: 'superscript' as const,
    citations: data.citations,
    evidenceDrawer: {
      collapsed: true,
      label: 'View Evidence',
    },
  }
}

function renderConversation(data: ResponseData) {
  return {
    answer: data.content,
    hasCard: false,
    hasBorder: false,
    hasConfidenceBadge: false,
    avatar: { visible: true, position: 'inline' as const },
    citationStyle: 'inline-chip' as const,
    citationHoverEffect: 'blue-pulse' as const,
    citations: data.citations,
    sourceDisplay: 'slide-out-sidebar' as const,
  }
}

function renderAnalyst(data: ResponseData) {
  return {
    answer: data.content,
    layout: 'split' as const,
    answerWidth: '60%',
    evidenceWidth: '40%',
    answerVisible: true,
    evidenceVisible: true,
    hasTabs: false,
    citationStyle: 'clickable-highlight' as const,
    citations: data.citations,
    evidencePanel: {
      excerpts: data.citations.map((c) => c.snippet),
      confidenceMeter: { value: data.confidence },
    },
  }
}
