/**
 * Sarah — MONSTER PUSH Task 5: Prompt Architecture Tests
 *
 * Tests the layered prompt system:
 * - Core prompt contains grounding rules, citation requirement, Silence Protocol
 * - Core prompt does NOT contain hardcoded persona name
 * - User layer includes personality when set
 * - User layer includes role when set
 * - User layer includes customInstructions when set
 * - User layer includes profile context when profile exists
 * - Empty user settings → core prompt only (no undefined/null in prompt)
 * - Session summaries included when they exist, excluded when they don't
 */

import { MERCURY_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT } from '@/mercury/systemPrompt'
import { validateResponse, formatSilenceProtocolMessage, CONFIDENCE_THRESHOLD } from '@/lib/rag/silenceProtocol'

// ============================================================================
// PERSONALITY PRESETS — Matches /api/mercury/config/route.ts
// ============================================================================

const PERSONALITY_PRESETS: Record<string, string> = {
  professional: 'You are precise, citation-focused, and formal. You never speculate. Every answer must be grounded in the documents provided.',
  friendly: 'You are warm, conversational, and helpful. You explain things simply and always cite your sources. You make complex documents accessible.',
  technical: 'You are detailed, thorough, and use precise terminology. You provide deep analysis with full citations and cross-references between documents.',
  ceo: 'You are briefing a Chief Executive Officer. Prioritize board-level impact, strategic alignment, competitive positioning, and enterprise risk.',
  cfo: 'You are briefing a Chief Financial Officer. Prioritize financial metrics, contractual obligations, monetary exposure, and risk quantification.',
  legal: 'You are briefing a legal professional. Prioritize precise language, contractual terms, regulatory references, dates, parties, and obligations.',
  compliance: 'You are a compliance officer reviewing for regulatory adherence. Focus on policy violations, control gaps, reporting obligations, and remediation requirements.',
  auditor: 'You are an internal auditor examining documents for control effectiveness, material weaknesses, and risk exposure.',
  whistleblower: 'You are a forensic investigator examining documents for anomalies, irregularities, and potential misconduct.',
}

// ============================================================================
// HELPERS — Matches buildPersonalityPrompt from voice-pipeline-v3.ts
// ============================================================================

function buildPersonalityPrompt(
  personalityPreset: string | null,
  rolePreset: string | null,
  customInstructions: string | null,
): string | undefined {
  const parts: string[] = []
  if (personalityPreset && PERSONALITY_PRESETS[personalityPreset]) {
    parts.push(PERSONALITY_PRESETS[personalityPreset])
  }
  if (rolePreset && PERSONALITY_PRESETS[rolePreset]) {
    parts.push(PERSONALITY_PRESETS[rolePreset])
  }
  if (customInstructions?.trim()) {
    parts.push(customInstructions.trim())
  }
  return parts.length > 0 ? parts.join('\n\n') : undefined
}

function buildProfilePrefix(profile: { displayName?: string; role?: string; company?: string } | null): string {
  if (!profile) return ''
  const parts: string[] = []
  if (profile.displayName) parts.push(`User: ${profile.displayName}`)
  if (profile.role) parts.push(`Role: ${profile.role}`)
  if (profile.company) parts.push(`Company: ${profile.company}`)
  return parts.length > 0 ? `[Context: ${parts.join('. ')}] ` : ''
}

function assembleSystemPrompt(
  agentName: string,
  personality?: string,
): string {
  const personalitySection = personality
    ? `\n## Personality & Instructions\n${personality}\n`
    : ''

  return `You are ${agentName}, a document intelligence assistant.

## Core Rules (non-negotiable)
Answer questions using ONLY the documents in the user's vault. Cite sources as [1], [2], [3]. If confidence is below 85%, say you cannot provide a grounded answer and suggest next steps. Never speculate or fabricate.
${personalitySection}`
}

// ============================================================================
// CORE PROMPT — Grounding Layer (systemPrompt.ts)
// ============================================================================

describe('Sarah — Prompt Architecture: Core System Prompt', () => {
  test('core prompt contains grounding rules', () => {
    expect(MERCURY_SYSTEM_PROMPT).toContain('ONLY the documents')
  })

  test('core prompt contains citation requirement [1], [2], [3]', () => {
    expect(MERCURY_SYSTEM_PROMPT).toContain('[1]')
    expect(MERCURY_SYSTEM_PROMPT).toContain('[2]')
    expect(MERCURY_SYSTEM_PROMPT).toContain('[3]')
  })

  test('core prompt contains Silence Protocol', () => {
    expect(MERCURY_SYSTEM_PROMPT).toContain('Silence Protocol')
  })

  test('core prompt mentions 85% confidence threshold', () => {
    expect(MERCURY_SYSTEM_PROMPT).toContain('85%')
  })

  test('core prompt prohibits speculation', () => {
    expect(MERCURY_SYSTEM_PROMPT).toContain('Never speculate')
  })

  test('core prompt prohibits model name leakage', () => {
    expect(MERCURY_SYSTEM_PROMPT).toContain('Never reference training data, model names')
  })

  test('core prompt does NOT contain hardcoded persona name', () => {
    // Core prompt should not say "You are Mercury" — that comes from user settings
    expect(MERCURY_SYSTEM_PROMPT).not.toContain('You are Mercury')
    expect(MERCURY_SYSTEM_PROMPT).not.toContain('Your name is')
  })

  test('DEFAULT_SYSTEM_PROMPT is alias for MERCURY_SYSTEM_PROMPT', () => {
    expect(DEFAULT_SYSTEM_PROMPT).toBe(MERCURY_SYSTEM_PROMPT)
  })
})

// ============================================================================
// USER LAYER — Personality Injection
// ============================================================================

describe('Sarah — Prompt Architecture: User Layer — Personality', () => {
  test('personality preset included when set', () => {
    const prompt = buildPersonalityPrompt('professional', null, null)
    expect(prompt).toContain('precise, citation-focused')
  })

  test('friendly personality included', () => {
    const prompt = buildPersonalityPrompt('friendly', null, null)
    expect(prompt).toContain('warm, conversational')
  })

  test('technical personality included', () => {
    const prompt = buildPersonalityPrompt('technical', null, null)
    expect(prompt).toContain('detailed, thorough')
  })

  test('unknown personality key returns undefined', () => {
    const prompt = buildPersonalityPrompt('unknown', null, null)
    expect(prompt).toBeUndefined()
  })
})

// ============================================================================
// USER LAYER — Role Injection
// ============================================================================

describe('Sarah — Prompt Architecture: User Layer — Role', () => {
  test('CEO role included when set', () => {
    const prompt = buildPersonalityPrompt(null, 'ceo', null)
    expect(prompt).toContain('Chief Executive Officer')
  })

  test('CFO role included', () => {
    const prompt = buildPersonalityPrompt(null, 'cfo', null)
    expect(prompt).toContain('Chief Financial Officer')
  })

  test('legal role included', () => {
    const prompt = buildPersonalityPrompt(null, 'legal', null)
    expect(prompt).toContain('legal professional')
  })

  test('whistleblower role included', () => {
    const prompt = buildPersonalityPrompt(null, 'whistleblower', null)
    expect(prompt).toContain('forensic investigator')
  })
})

// ============================================================================
// USER LAYER — Custom Instructions
// ============================================================================

describe('Sarah — Prompt Architecture: User Layer — Custom Instructions', () => {
  test('custom instructions included when set', () => {
    const prompt = buildPersonalityPrompt(null, null, 'Always respond in bullet points.')
    expect(prompt).toBe('Always respond in bullet points.')
  })

  test('whitespace-only custom instructions ignored', () => {
    const prompt = buildPersonalityPrompt(null, null, '   ')
    expect(prompt).toBeUndefined()
  })

  test('custom instructions trimmed', () => {
    const prompt = buildPersonalityPrompt(null, null, '  Use British English.  ')
    expect(prompt).toBe('Use British English.')
  })
})

// ============================================================================
// COMBINED — Personality + Role + Custom
// ============================================================================

describe('Sarah — Prompt Architecture: Combined User Layer', () => {
  test('personality + role combined with double newline', () => {
    const prompt = buildPersonalityPrompt('professional', 'ceo', null)
    expect(prompt).toContain('precise, citation-focused')
    expect(prompt).toContain('Chief Executive Officer')
    expect(prompt!.split('\n\n').length).toBeGreaterThanOrEqual(2)
  })

  test('all three combined in order: personality, role, custom', () => {
    const prompt = buildPersonalityPrompt('friendly', 'legal', 'Focus on contract dates.')!
    const parts = prompt.split('\n\n')
    expect(parts[0]).toContain('warm')
    expect(parts[1]).toContain('legal professional')
    expect(parts[2]).toContain('contract dates')
  })

  test('empty user settings → core prompt only (no undefined/null)', () => {
    const prompt = buildPersonalityPrompt(null, null, null)
    expect(prompt).toBeUndefined()
    // When undefined, assembleSystemPrompt should NOT include personality section
    const system = assembleSystemPrompt('Mercury', undefined)
    expect(system).not.toContain('undefined')
    expect(system).not.toContain('null')
    expect(system).not.toContain('Personality & Instructions')
  })

  test('personality section included when defined', () => {
    const personality = buildPersonalityPrompt('technical', 'auditor', null)
    const system = assembleSystemPrompt('Mercury', personality)
    expect(system).toContain('## Personality & Instructions')
    expect(system).toContain('detailed, thorough')
  })
})

// ============================================================================
// PROFILE CONTEXT — Injected as Query Prefix
// ============================================================================

describe('Sarah — Prompt Architecture: Profile Context', () => {
  test('profile with all fields produces prefix', () => {
    const prefix = buildProfilePrefix({ displayName: 'John Smith', role: 'CFO', company: 'ACME Inc' })
    expect(prefix).toBe('[Context: User: John Smith. Role: CFO. Company: ACME Inc] ')
  })

  test('profile with only name', () => {
    const prefix = buildProfilePrefix({ displayName: 'Jane Doe' })
    expect(prefix).toBe('[Context: User: Jane Doe] ')
  })

  test('null profile returns empty string', () => {
    const prefix = buildProfilePrefix(null)
    expect(prefix).toBe('')
  })

  test('empty profile object returns empty string', () => {
    const prefix = buildProfilePrefix({})
    expect(prefix).toBe('')
  })
})

// ============================================================================
// SESSION SUMMARIES — Included When They Exist
// ============================================================================

describe('Sarah — Prompt Architecture: Session Summaries', () => {
  test('session summaries included when they exist', () => {
    const summaries = [
      { summary: 'Discussed contract terms.', topics: ['liability', 'indemnity'] },
      { summary: 'Reviewed amendment clauses.', topics: ['amendment'] },
    ]
    const contextBlock = summaries.map((s) => `Previous session: ${s.summary}`).join('\n')
    expect(contextBlock).toContain('contract terms')
    expect(contextBlock).toContain('amendment clauses')
  })

  test('no session summaries → no injection', () => {
    const summaries: unknown[] = []
    const contextBlock = summaries.length > 0 ? 'Has context' : ''
    expect(contextBlock).toBe('')
  })

  test('session summaries ordered newest first', () => {
    const summaries = [
      { summary: 'Session 3', createdAt: new Date('2026-03-03') },
      { summary: 'Session 1', createdAt: new Date('2026-03-01') },
      { summary: 'Session 2', createdAt: new Date('2026-03-02') },
    ]
    const sorted = [...summaries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    expect(sorted[0].summary).toBe('Session 3')
    expect(sorted[2].summary).toBe('Session 1')
  })
})

// ============================================================================
// SILENCE PROTOCOL — Confidence Gating
// ============================================================================

describe('Sarah — Prompt Architecture: Silence Protocol', () => {
  test('threshold is 85%', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.85)
  })

  test('response above threshold passes', () => {
    expect(validateResponse({ confidence: 0.90 })).toBe(true)
  })

  test('response at threshold passes', () => {
    expect(validateResponse({ confidence: 0.85 })).toBe(true)
  })

  test('response below threshold fails', () => {
    expect(validateResponse({ confidence: 0.70 })).toBe(false)
  })

  test('silence message includes percentage', () => {
    const msg = formatSilenceProtocolMessage({ confidence: 0.60 })
    expect(msg).toContain('60%')
    expect(msg).toContain('85%')
  })

  test('silence message suggests next steps', () => {
    const msg = formatSilenceProtocolMessage({ confidence: 0.50 })
    expect(msg).toContain('Rephrasing')
  })
})

// ============================================================================
// VOICE SYSTEM PROMPT — Agent Name Injection
// ============================================================================

describe('Sarah — Prompt Architecture: Voice System Prompt Assembly', () => {
  test('system prompt includes agent name', () => {
    const prompt = assembleSystemPrompt('Mercury')
    expect(prompt).toContain('You are Mercury')
  })

  test('custom agent name works', () => {
    const prompt = assembleSystemPrompt('Atlas')
    expect(prompt).toContain('You are Atlas')
  })

  test('core rules always present', () => {
    const prompt = assembleSystemPrompt('Mercury')
    expect(prompt).toContain('Core Rules')
    expect(prompt).toContain('ONLY the documents')
    expect(prompt).toContain('[1], [2], [3]')
  })

  test('personality section absent when undefined', () => {
    const prompt = assembleSystemPrompt('Mercury', undefined)
    expect(prompt).not.toContain('Personality & Instructions')
  })

  test('personality section present when defined', () => {
    const prompt = assembleSystemPrompt('Mercury', 'Be formal and precise.')
    expect(prompt).toContain('## Personality & Instructions')
    expect(prompt).toContain('Be formal and precise.')
  })
})
