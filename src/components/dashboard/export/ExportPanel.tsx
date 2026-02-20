'use client'

import React, { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

type AuditFormat = 'pdf' | 'csv' | 'json'

const FORMAT_OPTIONS: { value: AuditFormat; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
]

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

export function ExportPanel() {
  const [exporting, setExporting] = useState<string | null>(null)
  const [auditFormat, setAuditFormat] = useState<AuditFormat>('pdf')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleExport = async (
    key: string,
    endpoint: string,
    filename: string,
  ) => {
    if (exporting) return
    setExporting(key)
    try {
      const res = await apiFetch(endpoint)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      triggerDownload(blob, filename)
      toast.success('Export downloaded')
    } catch {
      toast.error('Export failed — try again')
    } finally {
      setExporting(null)
    }
  }

  const handleAuditExport = async () => {
    if (exporting) return
    setExporting('audit')
    try {
      const params = new URLSearchParams({ format: auditFormat })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await apiFetch(`/api/audit/export-formatted?${params}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const dateSuffix = new Date().toISOString().split('T')[0]
      const ext = auditFormat
      triggerDownload(blob, `ragbox_audit_${dateSuffix}.${ext}`)
      toast.success('Audit export downloaded')
    } catch {
      toast.error('Audit export failed — try again')
    } finally {
      setExporting(null)
    }
  }

  const dateSuffix = new Date().toISOString().split('T')[0]

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">
          Export
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Conversation Export */}
        <button
          onClick={() =>
            handleExport(
              'conversation',
              '/api/export?format=pdf',
              `ragbox_conversation_${dateSuffix}.pdf`,
            )
          }
          disabled={exporting !== null}
          className="w-full flex items-center gap-3 p-3 rounded-xl
                     bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)] hover:border-[var(--brand-blue)]/30
                     hover:bg-[var(--brand-blue)]/5 transition-all text-left disabled:opacity-50"
        >
          <Download
            className={`w-5 h-5 text-[var(--brand-blue)] ${exporting === 'conversation' ? 'animate-pulse' : ''}`}
          />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Export Conversation
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              Download as PDF
            </p>
          </div>
        </button>

        {/* Audit Export — upgraded with format + date range */}
        <div
          className="p-3 rounded-xl bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)]
                     space-y-3"
        >
          <div className="flex items-center gap-3">
            <Download
              className={`w-5 h-5 text-[var(--brand-blue)] shrink-0 ${exporting === 'audit' ? 'animate-pulse' : ''}`}
            />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Export Audit Trail
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Compliance-ready export
              </p>
            </div>
          </div>

          {/* Format toggle pills */}
          <div className="flex gap-1 rounded-lg bg-[var(--bg-tertiary)] p-1">
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAuditFormat(opt.value)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors
                  ${
                    auditFormat === opt.value
                      ? 'bg-[var(--brand-blue)] text-white' /* THEME-EXEMPT: white on brand */
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Date range inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-1">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-md border border-[var(--border-subtle)]
                           bg-[var(--bg-secondary)] text-[var(--text-secondary)]
                           focus:outline-none focus:ring-1 focus:ring-[var(--brand-blue)]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-1">
                End date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-md border border-[var(--border-subtle)]
                           bg-[var(--bg-secondary)] text-[var(--text-secondary)]
                           focus:outline-none focus:ring-1 focus:ring-[var(--brand-blue)]"
              />
            </div>
          </div>

          {/* Download button */}
          <button
            onClick={handleAuditExport}
            disabled={exporting !== null}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white text-xs font-semibold transition-colors disabled:opacity-50" /* THEME-EXEMPT: white on brand */
          >
            <Download className="w-3.5 h-3.5" />
            Download {auditFormat.toUpperCase()}
          </button>
        </div>

        {/* Vault Export */}
        <button
          onClick={() =>
            handleExport(
              'vault',
              '/api/export?format=zip',
              `ragbox_export_${dateSuffix}.zip`,
            )
          }
          disabled={exporting !== null}
          className="w-full flex items-center gap-3 p-3 rounded-xl
                     bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)] hover:border-[var(--brand-blue)]/30
                     hover:bg-[var(--brand-blue)]/5 transition-all text-left disabled:opacity-50"
        >
          <Download
            className={`w-5 h-5 text-[var(--brand-blue)] ${exporting === 'vault' ? 'animate-pulse' : ''}`}
          />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Export Vault Data
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              Full data package (GDPR)
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}
