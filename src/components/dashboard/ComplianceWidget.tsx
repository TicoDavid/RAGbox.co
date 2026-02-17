'use client'

import React, { useState, useCallback } from 'react'
import { FileText, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface ComplianceResult {
  date: string
  conversationsIngested: number
  messagesProcessed: number
  documentsCreated: string[]
  errors: string[]
}

export function ComplianceWidget() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComplianceResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runExport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/roam/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: 'yesterday' }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data.data)
      } else {
        setError(data.error || 'Export failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-orange-400" />
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">ROAM Compliance</h4>
        </div>
        <button
          onClick={runExport}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md
            bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-hover)]
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          {loading ? 'Exporting...' : 'Run Now'}
        </button>
      </div>

      {result && (
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-500">
            <CheckCircle className="w-3 h-3" />
            <span>Last export: {result.date}</span>
          </div>
          <div className="flex gap-4 text-[var(--text-secondary)]">
            <span>Conversations: {result.conversationsIngested}</span>
            <span>Messages: {result.messagesProcessed}</span>
          </div>
          {result.documentsCreated.length > 0 && (
            <div className="text-[var(--text-tertiary)]">
              {result.documentsCreated.length} documents indexed
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="flex items-center gap-1.5 text-amber-500">
              <AlertCircle className="w-3 h-3" />
              <span>{result.errors.length} errors</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}

      {!result && !error && !loading && (
        <p className="text-xs text-[var(--text-tertiary)]">
          Fetches ROAM conversations daily and indexes them as searchable documents.
        </p>
      )}
    </div>
  )
}
