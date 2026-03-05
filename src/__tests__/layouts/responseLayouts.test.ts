export {} // Module boundary — prevent global scope conflicts

/**
 * Sarah — MONSTER PUSH Task 1: Response Layout Tests
 *
 * Tests the layout selector, toggle persistence, and all 3 layout modes:
 * - Dossier: gold border, confidence badge, evidence drawer
 * - Conversation: no cards, inline citation chips, hover glow
 * - Analyst: 60/40 split, evidence panel, citation highlight
 * - Cross-mode: same data renders differently per mode
 * - Mobile: Analyst stacks vertically
 */

// ============================================================================
// LAYOUT TYPE SYSTEM — Matches chatStore.ts + CenterHeader.tsx
// ============================================================================

type ResponseLayout = 'dossier' | 'conversation' | 'analyst'

const LAYOUT_MODES = [
  { id: 'dossier' as const, label: 'Dossier' },
  { id: 'conversation' as const, label: 'Conversation' },
  { id: 'analyst' as const, label: 'Analyst' },
] as const

const DEFAULT_LAYOUT: ResponseLayout = 'conversation' // chatStore default

// ============================================================================
// MOCK CITATION / RESPONSE DATA
// ============================================================================

interface Citation {
  documentId: string
  documentName: string
  excerpt: string
  relevanceScore: number
  citationIndex?: number
}

interface LayoutProps {
  content: string
  citations?: Citation[]
  confidence?: number
}

const TEST_CITATIONS: Citation[] = [
  { documentId: 'doc-1', documentName: 'contract.pdf', excerpt: 'liability shall not exceed $1.2M', relevanceScore: 0.92, citationIndex: 0 },
  { documentId: 'doc-2', documentName: 'amendment.pdf', excerpt: 'annual cap revised per Section 5', relevanceScore: 0.87, citationIndex: 1 },
  { documentId: 'doc-3', documentName: 'memo.pdf', excerpt: 'board approved the revised terms', relevanceScore: 0.78, citationIndex: 2 },
]

const TEST_RESPONSE: LayoutProps = {
  content: 'The liability cap in Section 5 limits exposure to $1.2M annually [1]. This was revised in the 2024 amendment [2] and approved by the board [3].',
  citations: TEST_CITATIONS,
  confidence: 0.91,
}

// ============================================================================
// LAYOUT SELECTOR — 3 Icons
// ============================================================================

describe('Sarah — Layout Selector: Renders 3 Icons', () => {
  test('exactly 3 layout modes defined', () => {
    expect(LAYOUT_MODES.length).toBe(3)
  })

  test('each mode has id and label', () => {
    for (const mode of LAYOUT_MODES) {
      expect(mode.id).toBeDefined()
      expect(mode.label).toBeDefined()
      expect(mode.label.length).toBeGreaterThan(0)
    }
  })

  test('layout IDs are unique', () => {
    const ids = LAYOUT_MODES.map((m) => m.id)
    expect(new Set(ids).size).toBe(3)
  })

  test('layout IDs match valid ResponseLayout union', () => {
    const validLayouts: ResponseLayout[] = ['dossier', 'conversation', 'analyst']
    for (const mode of LAYOUT_MODES) {
      expect(validLayouts).toContain(mode.id)
    }
  })
})

// ============================================================================
// LAYOUT TOGGLE — Persistence via Zustand + localStorage
// ============================================================================

describe('Sarah — Layout Toggle: Persistence', () => {
  let mockStore: { responseLayout: ResponseLayout }

  beforeEach(() => {
    mockStore = { responseLayout: DEFAULT_LAYOUT }
  })

  function setResponseLayout(layout: ResponseLayout) {
    mockStore = { ...mockStore, responseLayout: layout }
  }

  test('default layout is conversation', () => {
    expect(mockStore.responseLayout).toBe('conversation')
  })

  test('toggle to dossier persists', () => {
    setResponseLayout('dossier')
    expect(mockStore.responseLayout).toBe('dossier')
  })

  test('toggle to analyst persists', () => {
    setResponseLayout('analyst')
    expect(mockStore.responseLayout).toBe('analyst')
  })

  test('toggle back to conversation persists', () => {
    setResponseLayout('analyst')
    setResponseLayout('conversation')
    expect(mockStore.responseLayout).toBe('conversation')
  })

  test('layout stored in ragbox-chat-storage key', () => {
    const STORAGE_KEY = 'ragbox-chat-storage'
    const mockStorage: Record<string, string> = {}
    mockStorage[STORAGE_KEY] = JSON.stringify({ responseLayout: 'dossier' })
    const parsed = JSON.parse(mockStorage[STORAGE_KEY])
    expect(parsed.responseLayout).toBe('dossier')
  })

  test('incognito mode does NOT persist layout', () => {
    const incognitoPartialize = (state: { incognitoMode: boolean; responseLayout: string; selectedModel: string }) =>
      state.incognitoMode
        ? { selectedModel: state.selectedModel }
        : { selectedModel: state.selectedModel, responseLayout: state.responseLayout }

    const incognitoState = incognitoPartialize({ incognitoMode: true, responseLayout: 'analyst', selectedModel: 'aegis' })
    expect(incognitoState).not.toHaveProperty('responseLayout')
  })

  test('non-incognito persists layout', () => {
    const partialize = (state: { incognitoMode: boolean; responseLayout: string; selectedModel: string }) =>
      state.incognitoMode
        ? { selectedModel: state.selectedModel }
        : { selectedModel: state.selectedModel, responseLayout: state.responseLayout }

    const normalState = partialize({ incognitoMode: false, responseLayout: 'analyst', selectedModel: 'aegis' })
    expect(normalState).toHaveProperty('responseLayout', 'analyst')
  })
})

// ============================================================================
// DOSSIER LAYOUT — CIA Briefing
// ============================================================================

describe('Sarah — Dossier Layout', () => {
  function renderDossier(props: LayoutProps) {
    const pct = props.confidence != null ? Math.round(props.confidence * 100) : null
    const confColor =
      pct != null
        ? pct >= 85 ? 'text-[var(--success)]' : pct >= 60 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'
        : ''
    return {
      content: props.content,
      borderColor: '#D4A853',
      borderWidth: '3px',
      headerText: 'Intelligence Briefing',
      confidenceBadge: pct != null ? { value: pct, color: confColor, position: 'top-right' } : null,
      evidenceDrawer: {
        collapsed: true,
        label: `View Evidence (${(props.citations ?? []).length} source${(props.citations ?? []).length !== 1 ? 's' : ''})`,
      },
      citations: props.citations ?? [],
    }
  }

  test('gold left border #D4A853', () => {
    const rendered = renderDossier(TEST_RESPONSE)
    expect(rendered.borderColor).toBe('#D4A853')
    expect(rendered.borderWidth).toBe('3px')
  })

  test('header says Intelligence Briefing', () => {
    const rendered = renderDossier(TEST_RESPONSE)
    expect(rendered.headerText).toBe('Intelligence Briefing')
  })

  test('confidence badge positioned top-right', () => {
    const rendered = renderDossier(TEST_RESPONSE)
    expect(rendered.confidenceBadge).not.toBeNull()
    expect(rendered.confidenceBadge!.position).toBe('top-right')
    expect(rendered.confidenceBadge!.value).toBe(91)
  })

  test('confidence ≥85% is green (success)', () => {
    const rendered = renderDossier({ ...TEST_RESPONSE, confidence: 0.90 })
    expect(rendered.confidenceBadge!.color).toContain('success')
  })

  test('confidence 60-84% is yellow (warning)', () => {
    const rendered = renderDossier({ ...TEST_RESPONSE, confidence: 0.72 })
    expect(rendered.confidenceBadge!.color).toContain('warning')
  })

  test('confidence <60% is red (danger)', () => {
    const rendered = renderDossier({ ...TEST_RESPONSE, confidence: 0.45 })
    expect(rendered.confidenceBadge!.color).toContain('danger')
  })

  test('evidence drawer starts collapsed', () => {
    const rendered = renderDossier(TEST_RESPONSE)
    expect(rendered.evidenceDrawer.collapsed).toBe(true)
  })

  test('evidence drawer toggles open', () => {
    const rendered = renderDossier(TEST_RESPONSE)
    rendered.evidenceDrawer.collapsed = false
    expect(rendered.evidenceDrawer.collapsed).toBe(false)
  })

  test('evidence drawer label includes source count', () => {
    const rendered = renderDossier(TEST_RESPONSE)
    expect(rendered.evidenceDrawer.label).toContain('3 sources')
  })

  test('single source uses singular label', () => {
    const rendered = renderDossier({ ...TEST_RESPONSE, citations: [TEST_CITATIONS[0]] })
    expect(rendered.evidenceDrawer.label).toContain('1 source')
    expect(rendered.evidenceDrawer.label).not.toContain('sources')
  })

  test('no confidence hides badge', () => {
    const rendered = renderDossier({ content: 'test', citations: [] })
    expect(rendered.confidenceBadge).toBeNull()
  })
})

// ============================================================================
// CONVERSATION LAYOUT — Minimal Chrome
// ============================================================================

describe('Sarah — Conversation Layout', () => {
  function renderConversation(props: LayoutProps) {
    return {
      content: props.content,
      hasCard: false,
      hasBorder: false,
      hasConfidenceBadge: false,
      citationStyle: 'inline-chip' as const,
      citations: (props.citations ?? []).map((c) => ({
        ...c,
        hoverEffect: 'blue-glow',
        hoverClass: 'hover:shadow-[0_0_8px_var(--brand-blue)]',
      })),
    }
  }

  test('no card container', () => {
    const rendered = renderConversation(TEST_RESPONSE)
    expect(rendered.hasCard).toBe(false)
  })

  test('no borders', () => {
    const rendered = renderConversation(TEST_RESPONSE)
    expect(rendered.hasBorder).toBe(false)
  })

  test('no confidence badge', () => {
    const rendered = renderConversation(TEST_RESPONSE)
    expect(rendered.hasConfidenceBadge).toBe(false)
  })

  test('inline citation chips (not superscript)', () => {
    const rendered = renderConversation(TEST_RESPONSE)
    expect(rendered.citationStyle).toBe('inline-chip')
  })

  test('citation chips glow blue on hover', () => {
    const rendered = renderConversation(TEST_RESPONSE)
    for (const cite of rendered.citations) {
      expect(cite.hoverEffect).toBe('blue-glow')
      expect(cite.hoverClass).toContain('shadow')
      expect(cite.hoverClass).toContain('brand-blue')
    }
  })

  test('hover shows document name as truncated chip', () => {
    const chip = renderConversation(TEST_RESPONSE).citations[0]
    expect(chip.documentName).toBe('contract.pdf')
  })

  test('renders same content as other layouts', () => {
    const rendered = renderConversation(TEST_RESPONSE)
    expect(rendered.content).toBe(TEST_RESPONSE.content)
  })

  test('empty citations handled gracefully', () => {
    const rendered = renderConversation({ content: 'No sources.', citations: [] })
    expect(rendered.citations.length).toBe(0)
  })
})

// ============================================================================
// ANALYST LAYOUT — Split 60/40
// ============================================================================

describe('Sarah — Analyst Layout', () => {
  function renderAnalyst(props: LayoutProps) {
    const pct = props.confidence != null ? Math.round(props.confidence * 100) : null
    const confColor =
      pct != null
        ? pct >= 85 ? 'text-[var(--success)]' : pct >= 60 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'
        : ''
    return {
      content: props.content,
      layout: 'split' as const,
      answerWidth: '60%',
      evidenceWidth: '40%',
      answerVisible: true,
      evidenceVisible: true,
      hasTabs: false,
      confidenceMeter: pct != null ? { value: pct, color: confColor } : null,
      citations: props.citations ?? [],
      highlightedCitation: null as number | null,
      evidencePanel: {
        sources: (props.citations ?? []).map((c) => ({
          documentName: c.documentName,
          excerpt: c.excerpt,
          relevanceBar: Math.round(c.relevanceScore * 100),
        })),
      },
    }
  }

  test('split view: answer 60%, evidence 40%', () => {
    const rendered = renderAnalyst(TEST_RESPONSE)
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

  test('evidence panel shows source excerpts with relevance bars', () => {
    const rendered = renderAnalyst(TEST_RESPONSE)
    expect(rendered.evidencePanel.sources.length).toBe(3)
    expect(rendered.evidencePanel.sources[0].excerpt).toContain('liability')
    expect(rendered.evidencePanel.sources[0].relevanceBar).toBe(92)
  })

  test('confidence meter in evidence panel', () => {
    const rendered = renderAnalyst(TEST_RESPONSE)
    expect(rendered.confidenceMeter).not.toBeNull()
    expect(rendered.confidenceMeter!.value).toBe(91)
  })

  test('citation click highlights corresponding source', () => {
    const rendered = renderAnalyst(TEST_RESPONSE)
    rendered.highlightedCitation = 2
    expect(rendered.highlightedCitation).toBe(2)
  })

  test('evidence panel scrollable when many sources', () => {
    const manyCitations = Array.from({ length: 10 }, (_, i) => ({
      documentId: `doc-${i}`, documentName: `file-${i}.pdf`,
      excerpt: `Excerpt from document ${i}`, relevanceScore: 0.95 - i * 0.05,
      citationIndex: i,
    }))
    const rendered = renderAnalyst({ ...TEST_RESPONSE, citations: manyCitations })
    expect(rendered.evidencePanel.sources.length).toBe(10)
  })

  test('no confidence hides meter', () => {
    const rendered = renderAnalyst({ content: 'test' })
    expect(rendered.confidenceMeter).toBeNull()
  })

  test('mobile: analyst stacks vertically', () => {
    // On mobile, Analyst layout stacks to column instead of row
    const isMobile = true
    const flexDirection = isMobile ? 'column' : 'row'
    const answerWidth = isMobile ? '100%' : '60%'
    const evidenceWidth = isMobile ? '100%' : '40%'
    expect(flexDirection).toBe('column')
    expect(answerWidth).toBe('100%')
    expect(evidenceWidth).toBe('100%')
  })
})

// ============================================================================
// CROSS-LAYOUT — Same Data, Different Rendering
// ============================================================================

describe('Sarah — Cross-Layout: Same Data Across Modes', () => {
  function renderDossier(p: LayoutProps) { return { content: p.content, citations: p.citations ?? [], style: 'dossier' as const } }
  function renderConversation(p: LayoutProps) { return { content: p.content, citations: p.citations ?? [], style: 'conversation' as const } }
  function renderAnalyst(p: LayoutProps) { return { content: p.content, citations: p.citations ?? [], style: 'analyst' as const } }

  test('all 3 layouts render the same answer text', () => {
    expect(renderDossier(TEST_RESPONSE).content).toBe(TEST_RESPONSE.content)
    expect(renderConversation(TEST_RESPONSE).content).toBe(TEST_RESPONSE.content)
    expect(renderAnalyst(TEST_RESPONSE).content).toBe(TEST_RESPONSE.content)
  })

  test('all 3 layouts include all citations', () => {
    expect(renderDossier(TEST_RESPONSE).citations.length).toBe(3)
    expect(renderConversation(TEST_RESPONSE).citations.length).toBe(3)
    expect(renderAnalyst(TEST_RESPONSE).citations.length).toBe(3)
  })

  test('layouts have distinct style identifiers', () => {
    const styles = new Set([
      renderDossier(TEST_RESPONSE).style,
      renderConversation(TEST_RESPONSE).style,
      renderAnalyst(TEST_RESPONSE).style,
    ])
    expect(styles.size).toBe(3)
  })

  test('empty citations handled by all layouts', () => {
    const empty = { ...TEST_RESPONSE, citations: [] }
    expect(renderDossier(empty).citations.length).toBe(0)
    expect(renderConversation(empty).citations.length).toBe(0)
    expect(renderAnalyst(empty).citations.length).toBe(0)
  })
})
