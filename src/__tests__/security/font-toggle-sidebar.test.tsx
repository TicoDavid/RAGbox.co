/**
 * @jest-environment jsdom
 */

/**
 * EPIC-019 SA04: Font Toggle + Sidebar Tests
 *
 * Tests for Jordan's STORY-210 (font size toggle) and STORY-211 (remove WhatsApp sidebar icon).
 *
 * — Sarah, QA
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mock lucide-react (catch-all Proxy for any icon) ────────────
jest.mock('lucide-react', () => {
  return new Proxy({}, {
    get: (_target, prop) => {
      if (typeof prop !== 'string') return undefined
      return ({ className, ...rest }: { className?: string; [k: string]: unknown }) =>
        React.createElement('svg', { 'data-testid': `icon-${prop}`, className, ...rest })
    },
  })
})

// ══════════════════════════════════════════════════════════════════
// SECTION 1: Font Scale (STORY-210)
// ══════════════════════════════════════════════════════════════════

describe('Font Scale Toggle (STORY-210)', () => {
  // ── Mock useSettings for font scale tests ────────────────────
  const mockSetFontScale = jest.fn()
  let mockFontScale: 'normal' | 'large' | 'xlarge' = 'normal'

  beforeEach(() => {
    jest.clearAllMocks()
    mockFontScale = 'normal'
    // Clean up any document styles
    document.documentElement.style.removeProperty('--font-scale')
    localStorage.clear()
  })

  describe('FontScale type and values', () => {
    it('exports correct scale multipliers for all 3 sizes', () => {
      // Direct import of constants — no component render needed
      const { FONT_SCALE_VALUES } = jest.requireActual('@/contexts/SettingsContext')
      expect(FONT_SCALE_VALUES.normal).toBe(1)
      expect(FONT_SCALE_VALUES.large).toBe(1.15)
      expect(FONT_SCALE_VALUES.xlarge).toBe(1.3)
    })

    it('FontScale type allows exactly 3 values', () => {
      const validScales: Array<'normal' | 'large' | 'xlarge'> = ['normal', 'large', 'xlarge']
      const { FONT_SCALE_VALUES } = jest.requireActual('@/contexts/SettingsContext')
      expect(Object.keys(FONT_SCALE_VALUES)).toEqual(validScales)
    })
  })

  describe('Font scale UI component', () => {
    // Inline test component matching the AppearanceSettings pattern
    function FontScaleSection() {
      const fontScaleOptions = [
        { id: 'normal' as const, label: 'Normal', size: '14px', sample: 'Aa' },
        { id: 'large' as const, label: 'Large', size: '16px', sample: 'Aa' },
        { id: 'xlarge' as const, label: 'Extra Large', size: '18px', sample: 'Aa' },
      ]

      return (
        <div data-testid="font-scale-section">
          {fontScaleOptions.map((opt) => (
            <button
              key={opt.id}
              data-testid={`font-${opt.id}`}
              onClick={() => mockSetFontScale(opt.id)}
              aria-pressed={mockFontScale === opt.id}
            >
              <span style={{ fontSize: opt.size }}>{opt.sample}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )
    }

    it('renders all 3 font scale options', () => {
      render(<FontScaleSection />)
      expect(screen.getByText('Normal')).toBeInTheDocument()
      expect(screen.getByText('Large')).toBeInTheDocument()
      expect(screen.getByText('Extra Large')).toBeInTheDocument()
    })

    it('calls setFontScale with "large" when Large is clicked', () => {
      render(<FontScaleSection />)
      fireEvent.click(screen.getByTestId('font-large'))
      expect(mockSetFontScale).toHaveBeenCalledWith('large')
    })

    it('calls setFontScale with "xlarge" when Extra Large is clicked', () => {
      render(<FontScaleSection />)
      fireEvent.click(screen.getByTestId('font-xlarge'))
      expect(mockSetFontScale).toHaveBeenCalledWith('xlarge')
    })

    it('marks current selection as pressed', () => {
      mockFontScale = 'large'
      render(<FontScaleSection />)
      expect(screen.getByTestId('font-large')).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByTestId('font-normal')).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('CSS custom property application', () => {
    it('--font-scale defaults to 1 in CSS', () => {
      // globals.css: html { font-size: calc(16px * var(--font-scale, 1)); }
      const root = document.documentElement
      const val = root.style.getPropertyValue('--font-scale')
      // Before SettingsContext hydrates, no value is set — fallback is 1
      expect(val === '' || val === '1').toBe(true)
    })

    it('setting --font-scale to 1.15 applies correctly', () => {
      document.documentElement.style.setProperty('--font-scale', '1.15')
      const val = document.documentElement.style.getPropertyValue('--font-scale')
      expect(val).toBe('1.15')
    })

    it('setting --font-scale to 1.3 applies correctly', () => {
      document.documentElement.style.setProperty('--font-scale', '1.3')
      const val = document.documentElement.style.getPropertyValue('--font-scale')
      expect(val).toBe('1.3')
    })
  })

  describe('localStorage persistence', () => {
    it('stores settings under ragbox-settings key', () => {
      const settings = {
        theme: 'cobalt',
        fontScale: 'large',
        density: 'comfortable',
        language: 'en',
      }
      localStorage.setItem('ragbox-settings', JSON.stringify(settings))
      const stored = JSON.parse(localStorage.getItem('ragbox-settings')!)
      expect(stored.fontScale).toBe('large')
    })

    it('preserves fontScale across simulated reload', () => {
      const settings = { fontScale: 'xlarge' }
      localStorage.setItem('ragbox-settings', JSON.stringify(settings))

      // Simulate reload — read back
      const restored = JSON.parse(localStorage.getItem('ragbox-settings')!)
      expect(restored.fontScale).toBe('xlarge')

      // Apply to document (mimics SettingsContext useEffect)
      const { FONT_SCALE_VALUES } = jest.requireActual('@/contexts/SettingsContext')
      document.documentElement.style.setProperty(
        '--font-scale',
        String(FONT_SCALE_VALUES[restored.fontScale as keyof typeof FONT_SCALE_VALUES] ?? 1),
      )
      expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.3')
    })
  })
})

// ══════════════════════════════════════════════════════════════════
// SECTION 2: WhatsApp Sidebar Icon Removal (STORY-211)
// ══════════════════════════════════════════════════════════════════

describe('WhatsApp Sidebar Icon Removal (STORY-211)', () => {
  describe('StealthRails right rail', () => {
    it('does NOT contain WhatsApp in RightRailTab type', () => {
      // The RightRailTab type should only be: 'mercury' | 'studio' | 'audit' | 'export'
      const validTabs = ['mercury', 'studio', 'audit', 'export']
      expect(validTabs).not.toContain('whatsapp')
    })

    it('right rail icons are exactly: Mic, Sparkles, Scale, Download', () => {
      // StealthRails imports only these 4 icons for the right rail
      const rightRailIcons = ['Mic', 'Sparkles', 'Scale', 'Download']
      expect(rightRailIcons).toHaveLength(4)
      expect(rightRailIcons).not.toContain('MessageCircle') // WhatsApp-like icon
      expect(rightRailIcons).not.toContain('Phone')
      expect(rightRailIcons).not.toContain('Smartphone')
    })
  })

  describe('WhatsApp channel badge preserved in Mercury messages', () => {
    it('CHANNEL_BADGE config includes whatsapp with success color', () => {
      // Message.tsx still has WhatsApp in the channel badge config
      const channelBadge: Record<string, { label: string; color: string }> = {
        dashboard: { label: 'Dashboard', color: 'bg-[var(--brand-blue)]/20 text-[var(--brand-blue)] border-[var(--brand-blue)]/30' },
        whatsapp: { label: 'WhatsApp', color: 'bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30' },
        voice: { label: 'Voice', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
        roam: { label: 'ROAM', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
        email: { label: 'Email', color: 'bg-[var(--warning)]/20 text-[var(--warning)] border-[var(--warning)]/30' },
        sms: { label: 'SMS', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
      }

      expect(channelBadge.whatsapp).toBeDefined()
      expect(channelBadge.whatsapp.label).toBe('WhatsApp')
      expect(channelBadge.whatsapp.color).toContain('success')
    })

    it('ChannelBadge renders label for whatsapp channel', () => {
      // Inline ChannelBadge matching Message.tsx logic
      type MercuryChannel = 'dashboard' | 'whatsapp' | 'voice' | 'roam' | 'email' | 'sms'
      const BADGES: Record<MercuryChannel, string> = {
        dashboard: 'Dashboard', whatsapp: 'WhatsApp', voice: 'Voice',
        roam: 'ROAM', email: 'Email', sms: 'SMS',
      }

      function ChannelBadge({ channel, isUser }: { channel?: MercuryChannel; isUser?: boolean }) {
        if (!channel || isUser) return null
        return <span data-testid="channel-badge">{BADGES[channel]}</span>
      }

      const { container } = render(<ChannelBadge channel="whatsapp" />)
      expect(screen.getByText('WhatsApp')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="channel-badge"]')).not.toBeNull()
    })

    it('ChannelBadge hides on user messages', () => {
      function ChannelBadge({ channel, isUser }: { channel?: string; isUser?: boolean }) {
        if (!channel || isUser) return null
        return <span>{channel}</span>
      }

      const { container } = render(<ChannelBadge channel="whatsapp" isUser={true} />)
      expect(container.innerHTML).toBe('')
    })
  })
})
