'use client'

import React, { useState } from 'react'
import { useMercuryStore } from '@/stores/mercuryStore'
import { RefreshCw, Pencil, ChevronDown } from 'lucide-react'
import { TEMPERATURE_PRESETS } from '@/types/ragbox'
import type { TemperaturePreset } from '@/types/ragbox'

export function ContextBar() {
  const temperaturePreset = useMercuryStore((s) => s.temperaturePreset)
  const setTemperaturePreset = useMercuryStore((s) => s.setTemperaturePreset)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const currentPreset = TEMPERATURE_PRESETS[temperaturePreset]

  // Group presets by category
  const executive = Object.entries(TEMPERATURE_PRESETS).filter(([, v]) => v.category === 'EXECUTIVE')
  const compliance = Object.entries(TEMPERATURE_PRESETS).filter(([, v]) => v.category === 'COMPLIANCE')

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
      {/* Vault tags */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-xs text-[var(--text-tertiary)]">All documents</span>
      </div>

      {/* Temperature Dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border-default)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <span>{currentPreset.icon}</span>
          <span className="text-xs font-medium">{currentPreset.label}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-52 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-xl z-50 py-1 overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                Executive
              </div>
              {executive.map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => { setTemperaturePreset(key as TemperaturePreset); setDropdownOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--bg-hover)] transition-colors ${
                    key === temperaturePreset ? 'text-[var(--brand-blue)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.label}</span>
                  {key === temperaturePreset && <span className="ml-auto text-xs">✓</span>}
                </button>
              ))}

              <div className="border-t border-[var(--border-subtle)] my-1" />

              <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                Compliance
              </div>
              {compliance.map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => { setTemperaturePreset(key as TemperaturePreset); setDropdownOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--bg-hover)] transition-colors ${
                    key === temperaturePreset ? 'text-[var(--brand-blue)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.label}</span>
                  {key === temperaturePreset && <span className="ml-auto text-xs">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Refresh */}
      <button
        className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        title="Refresh Context"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      {/* Edit vaults */}
      <button
        className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        title="Edit Vaults"
      >
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  )
}
