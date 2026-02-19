'use client'

import { useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import { Download, Loader2, CheckCircle2, AlertCircle, FileArchive, FileText, Database } from 'lucide-react'

type ExportFormat = 'zip' | 'json' | 'pdf'

export default function ExportSettings() {
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [exportMessage, setExportMessage] = useState('')
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('zip')

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    setExportStatus('idle')

    try {
      const response = await apiFetch(`/api/export?format=${selectedFormat}`)
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Export failed' }))
        throw new Error(error.error || 'Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ragbox_export_${new Date().toISOString().split('T')[0]}.${selectedFormat}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setExportStatus('success')
      setExportMessage('Export completed successfully.')
    } catch (error) {
      setExportStatus('error')
      setExportMessage(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }, [selectedFormat])

  const formats = [
    { id: 'zip' as const, icon: FileArchive, label: 'ZIP Archive', description: 'All documents + metadata' },
    { id: 'json' as const, icon: Database, label: 'JSON', description: 'Metadata and query history' },
    { id: 'pdf' as const, icon: FileText, label: 'PDF Report', description: 'Audit log summary' },
  ]

  return (
    <div className="max-w-lg">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <Download size={16} className="text-[var(--brand-blue)]" />
        Export Data
      </h3>

      <p className="text-xs text-[var(--text-tertiary)] mb-4">
        Download your data in various formats. No lock-in - your data is always yours.
      </p>

      {/* Format Selection */}
      <div className="space-y-2 mb-6">
        {formats.map(({ id, icon: Icon, label, description }) => (
          <button
            key={id}
            onClick={() => setSelectedFormat(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
              selectedFormat === id
                ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10'
                : 'border-[var(--bg-tertiary)] bg-[var(--bg-primary)] hover:border-[var(--border-default)]'
            }`}
          >
            <Icon size={18} className={selectedFormat === id ? 'text-[var(--brand-blue)]' : 'text-[var(--text-tertiary)]'} />
            <div>
              <div className="text-xs font-medium text-[var(--text-primary)]">{label}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">{description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium text-black bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] disabled:opacity-50 transition-colors"
      >
        {isExporting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Preparing export...
          </>
        ) : (
          <>
            <Download size={14} />
            Export Data
          </>
        )}
      </button>

      {/* Status */}
      {exportStatus !== 'idle' && (
        <div className={`mt-3 flex items-center gap-2 text-xs ${
          exportStatus === 'success' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
        }`}>
          {exportStatus === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {exportMessage}
        </div>
      )}
    </div>
  )
}
