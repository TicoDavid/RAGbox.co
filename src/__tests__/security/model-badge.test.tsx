/**
 * @jest-environment jsdom
 */

/**
 * EPIC-019 SA05: Model Badge Tests
 *
 * Tests for Sheldon's STORY-026 (SSE metadata) and Jordan's STORY-212 (dynamic badge display).
 *
 * - ModelBadge renders "AEGIS" for default/aegis provider
 * - ModelBadge renders actual model name for BYOLLM (OpenRouter, direct API)
 * - SSE metadata event includes model_used, provider, latency_ms
 * - SSE done event extracts model_used
 * - Badge shows latency suffix when latencyMs provided
 *
 * — Sarah, QA
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

// ── Mock lucide-react ───────────────────────────────────────────
jest.mock('lucide-react', () => {
  return new Proxy({}, {
    get: (_target, prop) => {
      if (typeof prop !== 'string') return undefined
      return ({ className, ...rest }: { className?: string; [k: string]: unknown }) =>
        React.createElement('svg', { 'data-testid': `icon-${prop}`, className, ...rest })
    },
  })
})

// ── Import ModelBadge ───────────────────────────────────────────
import { ModelBadge } from '@/components/dashboard/mercury/ModelBadge'

// ══════════════════════════════════════════════════════════════════
// SECTION 1: ModelBadge Component (STORY-026 + STORY-212)
// ══════════════════════════════════════════════════════════════════

describe('ModelBadge Component (STORY-026)', () => {
  describe('AEGIS (default provider)', () => {
    it('renders "AEGIS" when no provider is set', () => {
      render(<ModelBadge modelUsed="aegis/sovereign-v2" />)
      expect(screen.getByText(/AEGIS/)).toBeInTheDocument()
    })

    it('renders "AEGIS" when provider is "aegis"', () => {
      render(<ModelBadge modelUsed="aegis/sovereign-v2" provider="aegis" />)
      expect(screen.getByText(/AEGIS/)).toBeInTheDocument()
    })

    it('aegis/ prefix without provider → AEGIS', () => {
      render(<ModelBadge modelUsed="aegis/sovereign-v2" />)
      expect(screen.getByText(/AEGIS/)).toBeInTheDocument()
    })

    it('aegis/ prefix WITH explicit non-aegis provider → BYOLLM (provider wins)', () => {
      // STORY-212: isAegis = modelUsed === 'aegis' || provider === 'aegis' || (!provider && modelUsed.startsWith('aegis'))
      // When provider is set to non-aegis, the prefix alone doesn't make it AEGIS
      render(<ModelBadge modelUsed="aegis/anything" provider="openrouter" />)
      expect(screen.queryByText('AEGIS')).not.toBeInTheDocument()
      expect(screen.getByText(/Anything/)).toBeInTheDocument()
    })

    it('uses brand-blue color class for AEGIS', () => {
      const { container } = render(<ModelBadge modelUsed="aegis/sovereign-v2" />)
      const badge = container.querySelector('span')
      expect(badge?.className).toContain('brand-blue')
    })

    it('shows lightning bolt emoji for AEGIS', () => {
      render(<ModelBadge modelUsed="aegis/sovereign-v2" />)
      expect(screen.getByText(/⚡/)).toBeInTheDocument()
    })
  })

  describe('BYOLLM (OpenRouter / direct API)', () => {
    it('renders human-friendly name for OpenRouter model', () => {
      render(<ModelBadge modelUsed="deepseek/deepseek-chat-v3.1" provider="openrouter" />)
      // formatModelLabel strips prefix + maps to known name
      expect(screen.getByText(/DeepSeek V3.1/)).toBeInTheDocument()
    })

    it('renders human-friendly name for direct API model', () => {
      render(<ModelBadge modelUsed="claude-3.5-sonnet" provider="anthropic" />)
      expect(screen.getByText(/Claude 3.5 Sonnet/)).toBeInTheDocument()
    })

    it('does NOT show "AEGIS" for non-aegis provider', () => {
      render(<ModelBadge modelUsed="gpt-4o" provider="openai" />)
      expect(screen.queryByText('AEGIS')).not.toBeInTheDocument()
    })

    it('uses neutral color class for BYOLLM', () => {
      const { container } = render(<ModelBadge modelUsed="gpt-4o" provider="openai" />)
      const badge = container.querySelector('span')
      // STORY-212: BYOLLM uses neutral bg-elevated styling
      expect(badge?.className).toContain('bg-elevated')
      expect(badge?.className).toContain('text-secondary')
    })

    it('shows robot emoji for BYOLLM', () => {
      render(<ModelBadge modelUsed="gpt-4o" provider="openai" />)
      expect(screen.getByText(/🤖/)).toBeInTheDocument()
    })
  })

  describe('Latency display', () => {
    it('shows latency suffix when latencyMs is provided', () => {
      render(<ModelBadge modelUsed="aegis/v2" latencyMs={1234} />)
      // 1234ms → "1.2s"
      expect(screen.getByText(/1\.2s/)).toBeInTheDocument()
    })

    it('omits latency suffix when latencyMs is not provided', () => {
      render(<ModelBadge modelUsed="aegis/v2" />)
      expect(screen.queryByText(/\ds/)).not.toBeInTheDocument()
    })

    it('shows "0.5s" for 500ms', () => {
      render(<ModelBadge modelUsed="gpt-4o" provider="openai" latencyMs={500} />)
      expect(screen.getByText(/0\.5s/)).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('returns null when modelUsed is not provided', () => {
      const { container } = render(<ModelBadge />)
      expect(container.innerHTML).toBe('')
    })

    it('returns null when modelUsed is empty string', () => {
      const { container } = render(<ModelBadge modelUsed="" />)
      expect(container.innerHTML).toBe('')
    })
  })
})

  describe('formatModelLabel (STORY-212 display names)', () => {
    it('maps DeepSeek V3.1 from OpenRouter slug', () => {
      render(<ModelBadge modelUsed="deepseek/deepseek-chat-v3.1" provider="openrouter" />)
      expect(screen.getByText(/DeepSeek V3.1/)).toBeInTheDocument()
    })

    it('maps Claude 3.5 Sonnet from slug', () => {
      render(<ModelBadge modelUsed="anthropic/claude-3.5-sonnet" provider="openrouter" />)
      expect(screen.getByText(/Claude 3.5 Sonnet/)).toBeInTheDocument()
    })

    it('maps GPT-4o from slug', () => {
      render(<ModelBadge modelUsed="openai/gpt-4o" provider="openrouter" />)
      expect(screen.getByText(/GPT-4o/)).toBeInTheDocument()
    })

    it('maps Gemini 2.5 Pro from slug', () => {
      render(<ModelBadge modelUsed="google/gemini-2.5-pro" provider="openrouter" />)
      expect(screen.getByText(/Gemini 2.5 Pro/)).toBeInTheDocument()
    })

    it('falls back to title-case for unknown models', () => {
      render(<ModelBadge modelUsed="custom/my-special-model" provider="openrouter" />)
      expect(screen.getByText(/My Special Model/)).toBeInTheDocument()
    })
  })

// ══════════════════════════════════════════════════════════════════
// SECTION 2: SSE Metadata Parsing (STORY-026 backend)
// ══════════════════════════════════════════════════════════════════

describe('SSE Metadata Event Parsing (STORY-026)', () => {
  describe('metadata event extraction', () => {
    it('extracts model_used from metadata SSE event', () => {
      // Simulates the mercuryStore SSE parsing for a metadata event
      const event = {
        type: 'metadata',
        model_used: 'deepseek/deepseek-chat-v3.1',
        provider: 'openrouter',
        latency_ms: 1234,
      }

      let modelUsed: string | undefined
      let provider: string | undefined
      let latencyMs: number | undefined

      // Replicate mercuryStore parsing logic (lines 356-362)
      modelUsed = event.model_used ?? modelUsed
      provider = event.provider ?? provider
      latencyMs = event.latency_ms ?? latencyMs

      expect(modelUsed).toBe('deepseek/deepseek-chat-v3.1')
      expect(provider).toBe('openrouter')
      expect(latencyMs).toBe(1234)
    })

    it('extracts model_used from done event with data wrapper', () => {
      // done event may wrap in { data: { ... } }
      const event = {
        type: 'done',
        data: {
          model_used: 'claude-3.5-sonnet',
          provider: 'anthropic',
          latency_ms: 890,
          answer: 'The answer is...',
        },
      }

      const d = event.data ?? event
      let modelUsed: string | undefined
      let provider: string | undefined
      let latencyMs: number | undefined

      if (d.model_used) modelUsed = d.model_used
      if (d.provider) provider = d.provider
      if (d.latency_ms != null) latencyMs = d.latency_ms

      expect(modelUsed).toBe('claude-3.5-sonnet')
      expect(provider).toBe('anthropic')
      expect(latencyMs).toBe(890)
    })

    it('extracts model_used from done event without data wrapper', () => {
      const event = {
        type: 'done',
        model_used: 'aegis/sovereign-v2',
        provider: 'aegis',
        latency_ms: 450,
      }

      const d = (event as Record<string, unknown>).data ?? event
      const modelUsed = (d as Record<string, unknown>).model_used
      expect(modelUsed).toBe('aegis/sovereign-v2')
    })

    it('extracts from confidence event', () => {
      const event = {
        type: 'confidence',
        score: 0.92,
        modelUsed: 'deepseek/deepseek-chat-v3.1',
        provider: 'openrouter',
        latencyMs: 1500,
      }

      // confidence event uses camelCase (lines 350-355)
      let modelUsed: string | undefined
      let provider: string | undefined
      let latencyMs: number | undefined

      modelUsed = event.modelUsed ?? modelUsed
      provider = event.provider ?? provider
      latencyMs = event.latencyMs ?? latencyMs

      expect(modelUsed).toBe('deepseek/deepseek-chat-v3.1')
      expect(provider).toBe('openrouter')
      expect(latencyMs).toBe(1500)
    })
  })

  describe('AEGIS vs BYOLLM detection (STORY-212 logic)', () => {
    // isAegis = modelUsed === 'aegis' || provider === 'aegis' || (!provider && modelUsed.startsWith('aegis'))
    function isAegis(modelUsed: string, provider?: string): boolean {
      return modelUsed === 'aegis' || provider === 'aegis' || (!provider && modelUsed.startsWith('aegis'))
    }

    it('modelUsed="aegis" (bare) → AEGIS', () => {
      expect(isAegis('aegis')).toBe(true)
    })

    it('provider="aegis" → AEGIS regardless of modelUsed', () => {
      expect(isAegis('anything', 'aegis')).toBe(true)
    })

    it('aegis/ prefix without provider → AEGIS', () => {
      expect(isAegis('aegis/sovereign-v2')).toBe(true)
    })

    it('aegis/ prefix WITH provider → BYOLLM (provider wins)', () => {
      expect(isAegis('aegis/custom', 'openrouter')).toBe(false)
    })

    it('provider="openrouter" → BYOLLM', () => {
      expect(isAegis('deepseek/deepseek-chat-v3.1', 'openrouter')).toBe(false)
    })

    it('provider="anthropic" → BYOLLM', () => {
      expect(isAegis('claude-3.5-sonnet', 'anthropic')).toBe(false)
    })
  })
})
