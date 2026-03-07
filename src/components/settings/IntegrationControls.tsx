'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Copy } from 'lucide-react'
import { toast } from 'sonner'

// ============================================================================
// TOGGLE
// ============================================================================

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full relative transition-colors ${
        checked ? 'bg-[var(--brand-blue)]' : 'bg-[var(--bg-elevated)]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--text-primary)] transition-all ${
          checked ? 'right-0.5' : 'left-0.5'
        }`}
      />
    </button>
  )
}

// ============================================================================
// TOGGLE ROW
// ============================================================================

export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-primary)]">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

// ============================================================================
// CREDENTIAL FIELD
// ============================================================================

export function CredentialField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string | null
  onChange: (v: string) => void
  type?: 'text' | 'password'
  placeholder?: string
}) {
  const [localValue, setLocalValue] = useState(value || '')
  const [focused, setFocused] = useState(false)

  // When we focus a masked field, clear it for fresh input
  const handleFocus = () => {
    setFocused(true)
    if (value && /^\*+/.test(value)) {
      setLocalValue('')
    }
  }

  const handleBlur = () => {
    setFocused(false)
    if (localValue && localValue !== value) {
      onChange(localValue)
    }
  }

  // Update local value when prop changes (e.g. after save)
  useEffect(() => {
    if (!focused) {
      setLocalValue(value || '')
    }
  }, [value, focused])

  return (
    <div>
      <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">{label}</label>
      <input
        type={type}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--border-default)] focus:outline-none focus:border-[var(--brand-blue)]"
      />
    </div>
  )
}

// ============================================================================
// READ-ONLY COPY FIELD
// ============================================================================

export function ReadOnlyCopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <div>
      <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">{label}</label>
      <div className="flex gap-1">
        <input
          type="text"
          readOnly
          value={value}
          className="flex-1 bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] rounded px-2 py-1.5 text-xs text-[var(--text-tertiary)] font-mono cursor-default"
        />
        <button
          onClick={handleCopy}
          className="px-2 py-1.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  )
}
