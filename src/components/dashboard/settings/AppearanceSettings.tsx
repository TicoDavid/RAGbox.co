'use client'

import React from 'react'
import { Check, LayoutGrid, Glasses } from 'lucide-react'
import { useSettings, type DensityId, type FontScale } from '@/contexts/SettingsContext'
import { ToggleSetting } from './shared'

function ThemeThumbnail({ bg, accent }: { bg: string; accent: string }) {
  return (
    <svg viewBox="0 0 200 120" className="w-full rounded-lg overflow-hidden" aria-hidden="true">
      {/* Background */}
      <rect width="200" height="120" fill={bg} />
      {/* Sidebar rail */}
      <rect x="0" y="0" width="4" height="120" fill={accent} opacity="0.8" />
      <rect x="4" y="0" width="36" height="120" fill={accent} opacity="0.08" />
      {/* Sidebar icons */}
      <circle cx="22" cy="20" r="4" fill={accent} opacity="0.4" />
      <circle cx="22" cy="36" r="4" fill={accent} opacity="0.25" />
      <circle cx="22" cy="52" r="4" fill={accent} opacity="0.25" />
      {/* Header bar */}
      <rect x="40" y="0" width="160" height="16" fill={accent} opacity="0.06" />
      <rect x="40" y="16" width="160" height="1" fill={accent} opacity="0.15" />
      {/* Header text placeholder */}
      <rect x="48" y="5" width="40" height="6" rx="2" fill={accent} opacity="0.2" />
      {/* Center content area */}
      <rect x="50" y="30" width="70" height="6" rx="2" fill={accent} opacity="0.15" />
      <rect x="50" y="42" width="55" height="4" rx="1.5" fill={accent} opacity="0.08" />
      <rect x="50" y="50" width="62" height="4" rx="1.5" fill={accent} opacity="0.08" />
      {/* Chat message bubble */}
      <rect x="50" y="64" width="50" height="14" rx="4" fill={accent} opacity="0.12" />
      <rect x="55" y="69" width="30" height="3" rx="1" fill={accent} opacity="0.2" />
      {/* Right panel outline (Mercury) */}
      <rect x="148" y="17" width="52" height="103" fill={accent} opacity="0.04" />
      <rect x="148" y="17" width="1" height="103" fill={accent} opacity="0.15" />
      {/* Right panel header */}
      <rect x="155" y="24" width="28" height="4" rx="1.5" fill={accent} opacity="0.18" />
      {/* Right panel message lines */}
      <rect x="155" y="36" width="36" height="3" rx="1" fill={accent} opacity="0.1" />
      <rect x="155" y="44" width="28" height="3" rx="1" fill={accent} opacity="0.1" />
      {/* Input bar at bottom */}
      <rect x="50" y="90" width="88" height="18" rx="9" fill={accent} opacity="0.08" />
      <rect x="60" y="96" width="40" height="4" rx="2" fill={accent} opacity="0.12" />
    </svg>
  )
}

export function AppearanceSettings() {
  const { theme, setTheme, density, setDensity, fontScale, setFontScale } = useSettings()

  const themes: {
    id: 'cobalt' | 'noir' | 'forest' | 'obsidian'
    name: string
    subtitle: string
    description: string
    bg: string
    accent: string
  }[] = [
    { id: 'cobalt', name: 'Midnight Cobalt', subtitle: 'Default sovereign blue', description: 'Best for extended sessions', bg: '#0B1120', accent: '#2563EB' },
    { id: 'noir', name: 'Cyber Noir', subtitle: 'OLED black, neon cyan', description: 'Maximum contrast, minimal glare', bg: '#000000', accent: '#06B6D4' },
    { id: 'forest', name: 'Forest Dark', subtitle: 'Military field dark', description: 'Low visibility environments', bg: '#0A1F0A', accent: '#22C55E' },
    { id: 'obsidian', name: 'Obsidian Gold', subtitle: 'Executive luxury', description: 'Premium client-facing mode', bg: '#0B1120', accent: '#D4A843' },
  ]

  const densityOptions: { id: DensityId; label: string; description: string }[] = [
    { id: 'compact', label: 'Compact', description: 'Tighter spacing, more content visible' },
    { id: 'comfortable', label: 'Comfortable', description: 'Standard spacing, easier reading' },
  ]

  return (
    <div className="space-y-8">
      {/* Theme Section */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Theme</h3>
        <p className="text-xs text-[var(--text-tertiary)] mb-4">
          Select your operational environment.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {themes.map((t) => {
            const isSelected = theme === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`relative text-left rounded-xl border-2 overflow-hidden transition-all duration-300 ${
                  isSelected
                    ? 'border-[var(--brand-blue)] shadow-[0_0_20px_-5px_var(--brand-blue)]'
                    : 'border-[var(--border-default)] hover:border-[var(--border-strong)]'
                }`}
              >
                {isSelected && (
                  <div
                    className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: t.accent }}
                  >
                    <Check className="w-3 h-3 text-black" />
                  </div>
                )}

                <ThemeThumbnail bg={t.bg} accent={t.accent} />

                <div className="px-3 py-2.5">
                  <p className={`text-sm font-semibold mb-0.5 ${isSelected ? 'text-[var(--brand-blue)]' : 'text-[var(--text-primary)]'}`}>
                    {t.name}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)] leading-tight">{t.subtitle}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] leading-tight mt-0.5 italic">{t.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)]" />

      {/* Density Section */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Display Density</h3>
        <p className="text-xs text-[var(--text-tertiary)] mb-4">
          Adjust the spacing and size of interface elements.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {densityOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setDensity(option.id)}
              className={`p-4 rounded-xl border-2 transition-all ${
                density === option.id
                  ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 shadow-[0_0_15px_-5px_var(--brand-blue)]'
                  : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/30'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg mb-3 flex items-center justify-center ${
                density === option.id ? 'bg-[var(--brand-blue)]/20' : 'bg-[var(--bg-elevated)]/30'
              }`}>
                <LayoutGrid className={`w-5 h-5 ${density === option.id ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'}`} />
              </div>
              <p className={`text-sm font-semibold mb-1 ${density === option.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {option.label}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)]" />

      {/* Font Size Section (Accessibility) */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Glasses className="w-4 h-4 text-[var(--text-secondary)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Font Size</h3>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mb-4">
          Scale all text for improved readability.
        </p>

        <div className="grid grid-cols-3 gap-3">
          {([
            { id: 'normal' as FontScale, label: 'Normal', size: '14px', sample: 'Aa' },
            { id: 'large' as FontScale, label: 'Large', size: '16px', sample: 'Aa' },
            { id: 'xlarge' as FontScale, label: 'Extra Large', size: '18px', sample: 'Aa' },
          ]).map((option) => (
            <button
              key={option.id}
              onClick={() => setFontScale(option.id)}
              className={`p-3 rounded-xl border-2 transition-all text-center ${
                fontScale === option.id
                  ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 shadow-[0_0_15px_-5px_var(--brand-blue)]'
                  : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/30'
              }`}
            >
              <div
                className={`font-semibold mb-1 ${fontScale === option.id ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'}`}
                style={{ fontSize: option.size }}
              >
                {option.sample}
              </div>
              <p className={`text-sm font-semibold mb-0.5 ${fontScale === option.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {option.label}
              </p>
              <p className="text-[10px] text-[var(--text-tertiary)]">{option.size} base</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function NotificationSettings() {
  const { notifications, setNotification } = useSettings()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Notification Preferences</h3>
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          Configure how you receive notifications.
        </p>
      </div>

      <div className="space-y-4">
        <ToggleSetting
          label="Email Notifications"
          description="Receive updates about document processing"
          enabled={notifications.email}
          onToggle={() => setNotification('email', !notifications.email)}
        />
        <ToggleSetting
          label="Push Notifications"
          description="Browser push notifications for real-time alerts"
          enabled={notifications.push}
          onToggle={() => setNotification('push', !notifications.push)}
        />
        <ToggleSetting
          label="Audit Trail Alerts"
          description="Get notified when privileged documents are accessed"
          enabled={notifications.audit}
          onToggle={() => setNotification('audit', !notifications.audit)}
        />
      </div>
    </div>
  )
}
