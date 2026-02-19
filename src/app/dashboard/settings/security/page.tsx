'use client'

import { useState } from 'react'
import { Shield, Key, Monitor, AlertTriangle } from 'lucide-react'

export default function SecuritySettings() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  return (
    <div className="max-w-lg">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <Shield size={16} className="text-[var(--brand-blue)]" />
        Security Settings
      </h3>

      {/* Two-Factor Authentication */}
      <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Key size={14} className="text-[var(--brand-blue)]" />
            <span className="text-xs font-medium text-[var(--text-primary)]">Two-Factor Authentication</span>
          </div>
          <button
            onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
            className={`w-10 h-5 rounded-full relative transition-colors ${
              twoFactorEnabled ? 'bg-[var(--brand-blue)]' : 'bg-[var(--bg-elevated)]'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--text-primary)] transition-all ${
                twoFactorEnabled ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)]">
          Add an extra layer of security to your account with TOTP-based authentication.
        </p>
      </div>

      {/* Active Sessions */}
      <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Monitor size={14} className="text-[var(--brand-blue)]" />
          <span className="text-xs font-medium text-[var(--text-primary)]">Active Sessions</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-[var(--bg-tertiary)]">
            <div>
              <div className="text-xs text-[var(--text-primary)]">Current Session</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">Chrome on Windows - Last active: now</div>
            </div>
            <span className="text-[10px] text-[var(--success)] px-2 py-0.5 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/20">
              Active
            </span>
          </div>
        </div>
        <button className="mt-3 text-[10px] text-[var(--danger)] hover:text-[var(--danger)]/80">
          Revoke all other sessions
        </button>
      </div>

      {/* API Keys */}
      <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Key size={14} className="text-[var(--warning)]" />
            <span className="text-xs font-medium text-[var(--text-primary)]">API Keys</span>
          </div>
          <button className="text-[10px] text-[var(--brand-blue)] hover:text-[var(--brand-blue-hover)]">
            + Generate Key
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)]">
          No API keys generated. Create one to access RAGbox via API.
        </p>
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={14} className="text-[var(--danger)]" />
          <span className="text-xs font-medium text-[var(--danger)]">Danger Zone</span>
        </div>
        <button className="text-[10px] text-[var(--danger)] border border-red-500/30 px-3 py-1.5 rounded hover:bg-red-500/10 transition-colors">
          Delete Account
        </button>
      </div>
    </div>
  )
}
