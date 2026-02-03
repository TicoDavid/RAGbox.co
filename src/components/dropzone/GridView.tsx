'use client'

import { FileText, Lock } from 'lucide-react'
import TierBadge from '@/components/ui/TierBadge'

interface DocumentItem {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: string
  status: string
  securityTier: number
  isPrivileged: boolean
}

interface GridViewProps {
  documents: DocumentItem[]
  onSelect: (id: string) => void
  selectedId?: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const TYPE_COLORS: Record<string, string> = {
  pdf: '#FF3D00',
  docx: '#3B82F6',
  doc: '#3B82F6',
  txt: '#888888',
  csv: '#22c55e',
  xlsx: '#22c55e',
  json: '#FFAB00',
  md: '#888888',
}

export default function GridView({ documents, onSelect, selectedId }: GridViewProps) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 p-2">
      {documents.map(doc => (
        <button
          key={doc.id}
          onClick={() => onSelect(doc.id)}
          className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all text-center ${
            selectedId === doc.id
              ? 'border-[#2463EB] bg-[#2463EB]/5'
              : 'border-[#222] bg-[#0a0a0a] hover:border-[#444]'
          }`}
        >
          <div className="relative">
            <FileText
              size={32}
              style={{ color: TYPE_COLORS[doc.type] || '#666' }}
            />
            {doc.isPrivileged && (
              <Lock size={10} className="absolute -top-1 -right-1 text-red-500" />
            )}
          </div>
          <div className="w-full">
            <div className="text-[11px] text-white truncate">{doc.name}</div>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <TierBadge tier={doc.securityTier} size="sm" />
              <span className="text-[10px] text-[#666]">{formatBytes(doc.size)}</span>
            </div>
          </div>
        </button>
      ))}

      {documents.length === 0 && (
        <div className="col-span-full py-8 text-center text-xs text-[#666]">
          No documents found
        </div>
      )}
    </div>
  )
}
