'use client'

import { HardDrive, Trash2, Clock } from 'lucide-react'

export default function VaultSettings() {
  return (
    <div className="max-w-lg">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <HardDrive size={16} className="text-[var(--brand-blue)]" />
        Vault Settings
      </h3>

      {/* Storage Usage */}
      <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[var(--text-primary)]">Storage Usage</span>
          <span className="text-[10px] text-[var(--text-tertiary)]">0 B / 50 GB</span>
        </div>
        <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full bg-[var(--brand-blue)]" style={{ width: '0%' }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div>
            <span className="text-[var(--text-tertiary)]">Documents: </span>
            <span className="text-[var(--text-primary)]">0</span>
          </div>
          <div>
            <span className="text-[var(--text-tertiary)]">Chunks: </span>
            <span className="text-[var(--text-primary)]">0</span>
          </div>
          <div>
            <span className="text-[var(--text-tertiary)]">Vaults: </span>
            <span className="text-[var(--text-primary)]">0</span>
          </div>
        </div>
      </div>

      {/* Retention Settings */}
      <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-[var(--warning)]" />
          <span className="text-xs font-medium text-[var(--text-primary)]">Retention Policy</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-[var(--bg-tertiary)]">
            <div>
              <div className="text-xs text-[var(--text-primary)]">Soft Delete Grace Period</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">Days before permanent deletion</div>
            </div>
            <select className="text-xs px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none">
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30" selected>30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-[var(--bg-tertiary)]">
            <div>
              <div className="text-xs text-[var(--text-primary)]">Audit Log Retention</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">WORM-compliant storage period</div>
            </div>
            <span className="text-xs text-[var(--brand-blue)] px-2 py-1 rounded bg-[var(--brand-blue)]/10 border border-[var(--brand-blue)]/30">
              7 years
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-xs text-[var(--text-primary)]">Encryption</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">At-rest encryption standard</div>
            </div>
            <span className="text-xs text-[var(--success)] px-2 py-1 rounded bg-[var(--success)]/10 border border-[var(--success)]/20">
              AES-256 (CMEK)
            </span>
          </div>
        </div>
      </div>

      {/* Purge */}
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trash2 size={14} className="text-[var(--danger)]" />
          <span className="text-xs font-medium text-[var(--danger)]">Data Purge</span>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)] mb-3">
          Permanently delete all documents and data. This action cannot be undone.
        </p>
        <button className="text-[10px] text-[var(--danger)] border border-red-500/30 px-3 py-1.5 rounded hover:bg-red-500/10 transition-colors">
          Purge All Data
        </button>
      </div>
    </div>
  )
}
