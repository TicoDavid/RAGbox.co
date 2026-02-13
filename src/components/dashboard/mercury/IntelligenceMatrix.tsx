'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  Brain,
  Zap,
  Globe,
  Key,
  Search,
  X,
  Check,
  Loader2,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { useSettings, type ActiveIntelligence, type IntelligenceTier } from '@/contexts/SettingsContext'
import {
  fetchOpenRouterModels,
  convertToIntelligenceOptions,
  searchModels,
  formatContextLength,
  AEGIS_INTELLIGENCE,
  MANAGED_FLEET,
  type IntelligenceOption,
} from '@/lib/intelligence/openrouter'

// ============================================================================
// TYPES
// ============================================================================

interface IntelligenceMatrixProps {
  isOpen: boolean
  onClose: () => void
  anchorRef?: React.RefObject<HTMLElement>
}

// ============================================================================
// TIER ICONS
// ============================================================================

const TIER_ICONS: Record<string, React.ReactNode> = {
  shield: <ShieldCheck className="w-4 h-4" />,
  brain: <Brain className="w-4 h-4" />,
  zap: <Zap className="w-4 h-4" />,
  globe: <Globe className="w-4 h-4" />,
  key: <Key className="w-4 h-4" />,
}

const TIER_COLORS: Record<IntelligenceTier, { bg: string; text: string; border: string }> = {
  native: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  managed: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
  },
  universe: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  private: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
}

// ============================================================================
// INTELLIGENCE OPTION ITEM
// ============================================================================

interface IntelligenceOptionItemProps {
  option: IntelligenceOption
  isSelected: boolean
  onSelect: () => void
}

function IntelligenceOptionItem({ option, isSelected, onSelect }: IntelligenceOptionItemProps) {
  const colors = TIER_COLORS[option.tier]
  const icon = TIER_ICONS[option.icon || 'globe']

  return (
    <button
      onClick={onSelect}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
        transition-all duration-150 text-left group
        ${isSelected
          ? `${colors.bg} ${colors.border} border`
          : 'hover:bg-white/5 border border-transparent'
        }
      `}
    >
      {/* Icon */}
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
        ${colors.bg} ${colors.text}
        ${option.tier === 'native' ? 'animate-pulse' : ''}
      `}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm ${isSelected ? colors.text : 'text-white'}`}>
            {option.displayName}
          </span>
          {option.contextLength && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
              {formatContextLength(option.contextLength)} ctx
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">{option.provider}</span>
          {option.description && (
            <>
              <span className="text-gray-600">·</span>
              <span className="text-xs text-gray-600 truncate">{option.description}</span>
            </>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className={`flex-shrink-0 ${colors.text}`}>
          <Check className="w-4 h-4" />
        </div>
      )}
    </button>
  )
}

// ============================================================================
// SECTION HEADER
// ============================================================================

interface SectionHeaderProps {
  title: string
  count?: number
  tier: IntelligenceTier
}

function SectionHeader({ title, count, tier }: SectionHeaderProps) {
  const colors = TIER_COLORS[tier]

  return (
    <div className="flex items-center gap-2 px-3 py-2 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-sm z-10">
      <div className={`w-1.5 h-1.5 rounded-full ${colors.text.replace('text-', 'bg-')}`} />
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {title}
      </span>
      {count !== undefined && (
        <span className="text-[10px] text-gray-600">({count})</span>
      )}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function IntelligenceMatrix({ isOpen, onClose, anchorRef }: IntelligenceMatrixProps) {
  const { activeIntelligence, setActiveIntelligence, connections } = useSettings()
  const [searchQuery, setSearchQuery] = useState('')
  const [universeModels, setUniverseModels] = useState<IntelligenceOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    } else {
      setSearchQuery('')
    }
  }, [isOpen])

  // Fetch OpenRouter models on mount
  useEffect(() => {
    async function loadModels() {
      setIsLoading(true)
      try {
        const models = await fetchOpenRouterModels()
        const options = convertToIntelligenceOptions(models)
        // Filter out managed fleet to avoid duplicates
        const managedIds = new Set(MANAGED_FLEET.map(m => m.id))
        setUniverseModels(options.filter(m => !managedIds.has(m.id)))
      } catch (error) {
        // ignored
      } finally {
        setIsLoading(false)
      }
    }
    loadModels()
  }, [])

  // Build private uplinks from connections
  const privateUplinks = useMemo<IntelligenceOption[]>(() => {
    return connections
      .filter(c => c.verified && c.selectedModel && c.type !== 'openrouter')
      .map(c => ({
        id: c.selectedModel!,
        name: c.selectedModel!.split('/')[1] || c.selectedModel!,
        displayName: c.name,
        provider: c.type === 'openai' ? 'OpenAI' : c.type === 'anthropic' ? 'Anthropic' : c.type,
        tier: 'private' as const,
        icon: 'key' as const,
      }))
  }, [connections])

  // Filter all models by search
  const filteredNative = useMemo(() =>
    searchModels([AEGIS_INTELLIGENCE], searchQuery),
    [searchQuery]
  )

  const filteredManaged = useMemo(() =>
    searchModels(MANAGED_FLEET, searchQuery),
    [searchQuery]
  )

  const filteredUniverse = useMemo(() =>
    searchModels(universeModels, searchQuery),
    [universeModels, searchQuery]
  )

  const filteredPrivate = useMemo(() =>
    searchModels(privateUplinks, searchQuery),
    [privateUplinks, searchQuery]
  )

  // Handle selection
  const handleSelect = useCallback((option: IntelligenceOption) => {
    const newIntel: ActiveIntelligence = {
      id: option.id,
      displayName: option.displayName,
      provider: option.provider,
      tier: option.tier,
    }
    setActiveIntelligence(newIntel)
    onClose()
  }, [setActiveIntelligence, onClose])

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Handle escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const totalResults = filteredNative.length + filteredManaged.length + filteredUniverse.length + filteredPrivate.length

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-0 mb-2 w-[420px] max-h-[480px]
                     bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl
                     overflow-hidden z-50 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className={`
                p-1.5 rounded-lg
                ${activeIntelligence.tier === 'native'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-cyan-500/20 text-cyan-400'
                }
              `}>
                {activeIntelligence.tier === 'native' ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-white">
                  Active: {activeIntelligence.displayName}
                </div>
                <div className="text-[10px] text-gray-500">
                  via {activeIntelligence.provider}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
              aria-label="Close model selector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                ref={searchInputRef}
                id="model-search"
                name="model-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 200+ models (Claude, Llama, Mistral...)"
                aria-label="Search AI models"
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg
                           text-sm text-white placeholder-gray-500
                           focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20
                           transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Model List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
              </div>
            ) : totalResults === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Search className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-sm">No models match "{searchQuery}"</span>
              </div>
            ) : (
              <div className="py-1">
                {/* RAGbox Native */}
                {filteredNative.length > 0 && (
                  <div>
                    <SectionHeader title="RAGbox Sovereign" tier="native" />
                    {filteredNative.map((option) => (
                      <IntelligenceOptionItem
                        key={option.id}
                        option={option}
                        isSelected={activeIntelligence.id === option.id}
                        onSelect={() => handleSelect(option)}
                      />
                    ))}
                  </div>
                )}

                {/* Managed Fleet */}
                {filteredManaged.length > 0 && (
                  <div className="mt-2">
                    <SectionHeader title="Managed Fleet" count={filteredManaged.length} tier="managed" />
                    {filteredManaged.map((option) => (
                      <IntelligenceOptionItem
                        key={option.id}
                        option={option}
                        isSelected={activeIntelligence.id === option.id}
                        onSelect={() => handleSelect(option)}
                      />
                    ))}
                  </div>
                )}

                {/* Private Uplinks */}
                {filteredPrivate.length > 0 && (
                  <div className="mt-2">
                    <SectionHeader title="Private Uplinks" count={filteredPrivate.length} tier="private" />
                    {filteredPrivate.map((option) => (
                      <IntelligenceOptionItem
                        key={option.id}
                        option={option}
                        isSelected={activeIntelligence.id === option.id}
                        onSelect={() => handleSelect(option)}
                      />
                    ))}
                  </div>
                )}

                {/* Open Universe */}
                {filteredUniverse.length > 0 && (
                  <div className="mt-2">
                    <SectionHeader title="Open Universe" count={filteredUniverse.length} tier="universe" />
                    {filteredUniverse.slice(0, 50).map((option) => (
                      <IntelligenceOptionItem
                        key={option.id}
                        option={option}
                        isSelected={activeIntelligence.id === option.id}
                        onSelect={() => handleSelect(option)}
                      />
                    ))}
                    {filteredUniverse.length > 50 && (
                      <div className="px-3 py-2 text-center text-xs text-gray-500">
                        + {filteredUniverse.length - 50} more models · Refine your search
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>
                {universeModels.length + MANAGED_FLEET.length + 1} models available
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Aegis = Sovereign
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ============================================================================
// TRIGGER BUTTON (To be used in InputBar)
// ============================================================================

interface IntelligenceBadgeProps {
  onClick: () => void
}

export function IntelligenceBadge({ onClick }: IntelligenceBadgeProps) {
  const { activeIntelligence, isAegisActive } = useSettings()

  return (
    <button
      onClick={onClick}
      aria-label={`Active model: ${activeIntelligence.displayName}. Click to change`}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg
        transition-all duration-500 ease-out group
        ${isAegisActive
          ? 'bg-amber-500/[0.06] border border-amber-500/25 shadow-[0_0_20px_-5px_rgba(245,158,11,0.2)]'
          : 'bg-white/[0.02] border border-white/[0.08] shadow-lg shadow-black/20'
        }
        hover:bg-white/[0.04] hover:border-amber-500/20
      `}
    >
      {/* Icon */}
      <div className={isAegisActive ? 'text-amber-500/80' : 'text-gray-400'}>
        {isAegisActive ? (
          <ShieldCheck className="w-3.5 h-3.5" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
      </div>

      {/* Name */}
      <span className="text-[11px] font-medium text-gray-300 tracking-wide">
        {activeIntelligence.displayName}
      </span>

      {/* Provider hint */}
      <span className="text-[9px] text-gray-500 tracking-wider uppercase">
        {isAegisActive ? 'Sovereign' : activeIntelligence.provider}
      </span>

      {/* Dropdown indicator */}
      <ChevronDown className="w-3 h-3 text-gray-500/50 transition-transform duration-500 group-hover:translate-y-0.5" />
    </button>
  )
}

export default IntelligenceMatrix
