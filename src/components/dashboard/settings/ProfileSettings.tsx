'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { SectionHeader } from './shared'

const INDUSTRIES = [
  'Legal', 'Finance', 'Healthcare', 'Technology', 'Government',
  'Education', 'Consulting', 'Real Estate', 'Insurance', 'Manufacturing', 'Other',
] as const

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'] as const

export function ProfileSettings() {
  const { data: session, update: updateSession } = useSession()
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(session?.user?.name || '')
  const [saving, setSaving] = useState(false)

  const userInitials = (editing ? displayName : session?.user?.name)
    ? (editing ? displayName : session?.user?.name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  const handleEdit = () => {
    setDisplayName(session?.user?.name || '')
    setEditing(true)
  }

  const handleCancel = () => {
    setDisplayName(session?.user?.name || '')
    setEditing(false)
  }

  const handleSave = async () => {
    const trimmed = displayName.trim()
    if (!trimmed) {
      toast.error('Display name cannot be empty')
      return
    }
    if (trimmed.length > 100) {
      toast.error('Display name must be 100 characters or less')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to update profile')
      }
      toast.success('Profile updated')
      setEditing(false)
      await updateSession()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Profile"
        description="Manage your identity and organizational role"
      />

      <div className="p-6 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] rounded-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--brand-blue)]/30 to-[var(--brand-blue)]/20 border-2 border-[var(--brand-blue)]/50 flex items-center justify-center text-xl font-semibold text-[var(--text-primary)]">
            {userInitials}
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
                  placeholder="Display name"
                  autoFocus
                />
                <p className="text-sm text-[var(--text-tertiary)]" title="Email cannot be changed">
                  {session?.user?.email || 'user@example.com'}
                </p>
              </div>
            ) : (
              <>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{session?.user?.name || 'Sovereign User'}</p>
                <p className="text-sm text-[var(--text-secondary)]">{session?.user?.email || 'user@example.com'}</p>
              </>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] px-2 py-0.5 bg-[var(--warning)]/20 text-[var(--warning)] rounded-full font-medium">
                ADMINISTRATOR
              </span>
            </div>
          </div>
          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !displayName.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={handleEdit}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-lg transition-colors"
              aria-label="Edit profile"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] rounded-lg">
          <p className="text-xs text-[var(--text-tertiary)] mb-1">Organization</p>
          <p className="text-sm font-medium text-[var(--text-primary)]">RAGböx</p>
        </div>
        <div className="p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] rounded-lg">
          <p className="text-xs text-[var(--text-tertiary)] mb-1">Role</p>
          <p className="text-sm font-medium text-[var(--text-primary)]">Sovereign Administrator</p>
        </div>
      </div>

      {/* Work Profile Sub-Section */}
      <WorkProfileSettings />
    </div>
  )
}

function WorkProfileSettings() {
  const [workProfile, setWorkProfile] = useState({
    companyName: '',
    jobTitle: '',
    industry: '',
    companySize: '',
    useCase: '',
  })
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/user/profile', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setWorkProfile({
            companyName: json.data.companyName || '',
            jobTitle: json.data.jobTitle || '',
            industry: json.data.industry || '',
            companySize: json.data.companySize || '',
            useCase: json.data.useCase || '',
          })
        }
        setLoaded(true)
      })
      .catch((err) => {
        logger.error('Failed to load work profile:', err)
        setLoaded(true)
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          companyName: workProfile.companyName || null,
          jobTitle: workProfile.jobTitle || null,
          industry: workProfile.industry || null,
          companySize: workProfile.companySize || null,
          useCase: workProfile.useCase || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save work profile')
      }
      toast.success('Work profile saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save work profile')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setWorkProfile((prev) => ({ ...prev, [field]: value }))
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-4 border-t border-[var(--border-default)]">
      <div>
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Work Profile</h4>
        <p className="text-xs text-[var(--text-tertiary)]">Your professional details for personalized experiences</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-[var(--text-tertiary)] mb-1">Company Name</label>
          <input
            type="text"
            value={workProfile.companyName}
            onChange={(e) => updateField('companyName', e.target.value)}
            maxLength={200}
            className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
            placeholder="Acme Corp"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-tertiary)] mb-1">Job Title</label>
          <input
            type="text"
            value={workProfile.jobTitle}
            onChange={(e) => updateField('jobTitle', e.target.value)}
            maxLength={100}
            className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
            placeholder="General Counsel"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-[var(--text-tertiary)] mb-1">Industry</label>
          <select
            value={workProfile.industry}
            onChange={(e) => updateField('industry', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
          >
            <option value="">Select industry</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-tertiary)] mb-1">Company Size</label>
          <select
            value={workProfile.companySize}
            onChange={(e) => updateField('companySize', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
          >
            <option value="">Select size</option>
            {COMPANY_SIZES.map((size) => (
              <option key={size} value={size}>{size} employees</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Use Case</label>
        <textarea
          value={workProfile.useCase}
          onChange={(e) => updateField('useCase', e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] resize-none transition-colors"
          placeholder="Describe how you plan to use RAGbox..."
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white rounded-lg transition-colors disabled:opacity-50"
      >
        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
        Save Work Profile
      </button>
    </div>
  )
}
