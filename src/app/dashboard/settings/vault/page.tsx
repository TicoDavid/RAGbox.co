'use client'

import { HardDrive, Trash2, Clock } from 'lucide-react'

export default function VaultSettings() {
  return (
    <div className="max-w-lg">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <HardDrive size={16} className="text-[#2463EB]" />
        Vault Settings
      </h3>

      {/* Storage Usage */}
      <div className="rounded-lg border border-[#222] bg-[#0a0a0a] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-white">Storage Usage</span>
          <span className="text-[10px] text-[#666]">0 B / 50 GB</span>
        </div>
        <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full bg-[#2463EB]" style={{ width: '0%' }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div>
            <span className="text-[#666]">Documents: </span>
            <span className="text-white">0</span>
          </div>
          <div>
            <span className="text-[#666]">Chunks: </span>
            <span className="text-white">0</span>
          </div>
          <div>
            <span className="text-[#666]">Vaults: </span>
            <span className="text-white">0</span>
          </div>
        </div>
      </div>

      {/* Retention Settings */}
      <div className="rounded-lg border border-[#222] bg-[#0a0a0a] p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-[#FFAB00]" />
          <span className="text-xs font-medium text-white">Retention Policy</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-[#222]">
            <div>
              <div className="text-xs text-white">Soft Delete Grace Period</div>
              <div className="text-[10px] text-[#666]">Days before permanent deletion</div>
            </div>
            <select className="text-xs px-2 py-1 rounded bg-[#111] border border-[#333] text-white focus:outline-none">
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30" selected>30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-[#222]">
            <div>
              <div className="text-xs text-white">Audit Log Retention</div>
              <div className="text-[10px] text-[#666]">WORM-compliant storage period</div>
            </div>
            <span className="text-xs text-[#2463EB] px-2 py-1 rounded bg-[#2463EB]/10 border border-[#2463EB]/30">
              7 years
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-xs text-white">Encryption</div>
              <div className="text-[10px] text-[#666]">At-rest encryption standard</div>
            </div>
            <span className="text-xs text-green-500 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
              AES-256 (CMEK)
            </span>
          </div>
        </div>
      </div>

      {/* Purge */}
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trash2 size={14} className="text-red-500" />
          <span className="text-xs font-medium text-red-500">Data Purge</span>
        </div>
        <p className="text-[10px] text-[#666] mb-3">
          Permanently delete all documents and data. This action cannot be undone.
        </p>
        <button className="text-[10px] text-red-500 border border-red-500/30 px-3 py-1.5 rounded hover:bg-red-500/10 transition-colors">
          Purge All Data
        </button>
      </div>
    </div>
  )
}
