'use client'

import React, { useState } from 'react'
import { Zap, FileText, Shield, Sparkles, Server, ExternalLink, Users, MessageSquare, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SectionHeader } from './shared'

export function DocumentationSettings() {
  const docs = [
    {
      title: 'Protocol Alpha: Initialization',
      description: 'Quick start guide for new sovereign operators',
      href: '/docs/getting-started',
      icon: <Zap className="w-4 h-4" />,
    },
    {
      title: 'The Sovereign Uplink (API)',
      description: 'Programmatic access to the RAGbox intelligence system',
      href: '/docs/api-reference',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      title: 'The Fortress Architecture',
      description: 'Encryption, compliance, and data sovereignty',
      href: '/docs/security-compliance',
      icon: <Shield className="w-4 h-4" />,
    },
    {
      title: 'Tactical Prompting',
      description: 'Master the art of intelligence extraction',
      href: '/docs/best-practices',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      title: 'MCP Server Spec',
      description: 'Model Context Protocol integration for AI agents',
      href: '/docs/mcp-server-spec',
      icon: <Server className="w-4 h-4" />,
    },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Documentation"
        description="Access guides, references, and best practices"
      />

      <div className="space-y-3">
        {docs.map((doc) => (
          <a
            key={doc.title}
            href={doc.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] hover:border-[var(--brand-blue)]/30 hover:bg-[var(--brand-blue)]/5 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--bg-tertiary)]group-hover:bg-[var(--brand-blue)]/20 rounded-lg transition-colors">
                <span className="text-[var(--text-secondary)] group-hover:text-[var(--brand-blue)] transition-colors">
                  {doc.icon}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--brand-blue)] transition-colors">{doc.title}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{doc.description}</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--brand-blue)] transition-colors" />
          </a>
        ))}
      </div>
    </div>
  )
}

export function ReportIssueSettings() {
  const [issueType, setIssueType] = useState<'bug' | 'feature' | 'question'>('bug')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!description.trim() || description.trim().length < 10) {
      toast.error('Description must be at least 10 characters')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: issueType,
          description: description.trim(),
          currentUrl: typeof window !== 'undefined' ? window.location.href : undefined,
          browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to submit report')
      }
      toast.success('Report submitted successfully')
      setDescription('')
      setIssueType('bug')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Report Issue"
        description="Submit a bug report or request a feature"
      />

      {/* Issue Type */}
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Issue Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(['bug', 'feature', 'question'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setIssueType(type)}
              className={`p-3 rounded-lg border text-sm font-medium capitalize transition-all ${
                issueType === type
                  ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="bug-description" className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Description</label>
        <textarea
          id="bug-description"
          name="bug-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue or feature request in detail..."
          rows={5}
          className="w-full px-4 py-3 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)] resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!description.trim() || submitting}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)] text-sm font-medium rounded-lg transition-colors"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Submit Report
      </button>
    </div>
  )
}

export function CommunitySettings() {
  const links = [
    { title: 'Discord Community', description: 'Join The Syndicate for real-time support', icon: <Users className="w-5 h-5" /> },
    { title: 'GitHub Discussions', description: 'Participate in open-source discussions', icon: <MessageSquare className="w-5 h-5" /> },
    { title: 'Twitter/X', description: 'Follow for updates and announcements', icon: <ExternalLink className="w-5 h-5" /> },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Community"
        description="Connect with other RAGbox users and contributors"
      />

      <div className="space-y-3">
        {links.map((link) => (
          <div
            key={link.title}
            title="Community coming soon"
            className="flex items-center gap-4 p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] rounded-xl opacity-50 cursor-not-allowed"
          >
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl">
              <span className="text-[var(--text-secondary)]">
                {link.icon}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {link.title}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">{link.description}</p>
            </div>
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  )
}
