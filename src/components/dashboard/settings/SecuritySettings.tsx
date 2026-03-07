'use client'

import React, { useState } from 'react'
import { Monitor, Lock, Shield, LogOut, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { SectionHeader } from './shared'

export function SecuritySettings() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [revoking, setRevoking] = useState(false)

  const handleRevoke = async () => {
    setRevoking(true)
    try {
      const res = await fetch('/api/v1/sessions', { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Failed to revoke sessions')
      }
      toast.success('All other sessions revoked')
      setConfirmOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke sessions')
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Security"
        description="Manage sessions, access controls, and security policies"
      />

      {/* Active Sessions */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Active Sessions</p>

        <div className="p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--success)]/20 rounded-lg">
              <Monitor className="w-4 h-4 text-[var(--success)]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">Current Session</p>
                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--success)]/20 text-[var(--success)] rounded">Active</span>
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">Windows · Chrome · Started 2 hours ago</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Lock className="w-8 h-8 text-[var(--text-tertiary)] mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">No other active sessions</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">You are only signed in on this device</p>
        </div>
      </div>

      {/* Security Actions */}
      <div className="space-y-3">
        <button className="w-full flex items-center justify-between p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-colors group" aria-label="Two-factor authentication settings">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">Two-Factor Authentication</span>
          </div>
          <span className="text-xs text-[var(--success)]">Enabled</span>
        </button>

        <button
          onClick={() => setConfirmOpen(true)}
          className="w-full flex items-center justify-between p-4 bg-[var(--danger)]/10 border border-[var(--danger)]/30 hover:border-[var(--danger)]/50 rounded-lg transition-colors"
          aria-label="Sign out all other devices"
        >
          <div className="flex items-center gap-3">
            <LogOut className="w-4 h-4 text-[var(--danger)]" />
            <span className="text-sm text-[var(--danger)]">Sign Out Other Devices</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--danger)]" />
        </button>
      </div>

      {/* Revoke Confirmation Dialog */}
      {confirmOpen && (
        <div className="p-4 bg-[var(--danger)]/5 border border-[var(--danger)]/30 rounded-xl space-y-3">
          <p className="text-sm font-medium text-[var(--text-primary)]">Sign out of all other devices?</p>
          <p className="text-xs text-[var(--text-secondary)]">
            This will revoke all sessions except your current one. You will stay signed in on this device.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--danger)] text-white hover:bg-[var(--danger)]/90 transition-colors disabled:opacity-50"
            >
              {revoking ? 'Revoking...' : 'Confirm Revoke'}
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
