'use client'

import { useState } from 'react'
import { Shield, Key, Monitor, AlertTriangle } from 'lucide-react'

export default function SecuritySettings() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  return (
    <div className="max-w-lg">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Shield size={16} className="text-[#00F0FF]" />
        Security Settings
      </h3>

      {/* Two-Factor Authentication */}
      <div className="rounded-lg border border-[#222] bg-[#0a0a0a] p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Key size={14} className="text-[#00F0FF]" />
            <span className="text-xs font-medium text-white">Two-Factor Authentication</span>
          </div>
          <button
            onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
            className={`w-10 h-5 rounded-full relative transition-colors ${
              twoFactorEnabled ? 'bg-[#00F0FF]' : 'bg-[#333]'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                twoFactorEnabled ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
        <p className="text-[10px] text-[#666]">
          Add an extra layer of security to your account with TOTP-based authentication.
        </p>
      </div>

      {/* Active Sessions */}
      <div className="rounded-lg border border-[#222] bg-[#0a0a0a] p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Monitor size={14} className="text-[#00F0FF]" />
          <span className="text-xs font-medium text-white">Active Sessions</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-[#222]">
            <div>
              <div className="text-xs text-white">Current Session</div>
              <div className="text-[10px] text-[#666]">Chrome on Windows - Last active: now</div>
            </div>
            <span className="text-[10px] text-green-500 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
              Active
            </span>
          </div>
        </div>
        <button className="mt-3 text-[10px] text-red-500 hover:text-red-400">
          Revoke all other sessions
        </button>
      </div>

      {/* API Keys */}
      <div className="rounded-lg border border-[#222] bg-[#0a0a0a] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Key size={14} className="text-[#FFAB00]" />
            <span className="text-xs font-medium text-white">API Keys</span>
          </div>
          <button className="text-[10px] text-[#00F0FF] hover:text-[#00D4E0]">
            + Generate Key
          </button>
        </div>
        <p className="text-[10px] text-[#666]">
          No API keys generated. Create one to access RAGbox via API.
        </p>
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={14} className="text-red-500" />
          <span className="text-xs font-medium text-red-500">Danger Zone</span>
        </div>
        <button className="text-[10px] text-red-500 border border-red-500/30 px-3 py-1.5 rounded hover:bg-red-500/10 transition-colors">
          Delete Account
        </button>
      </div>
    </div>
  )
}
