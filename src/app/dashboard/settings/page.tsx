'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  Download,
  Shield,
  Database,
  FileArchive,
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  Bell,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

/**
 * Settings Page - /dashboard/settings
 *
 * Features:
 * - One-click data export (S019)
 * - Account settings
 * - Security preferences
 * - Notification settings
 */
export default function SettingsPage() {
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [exportMessage, setExportMessage] = useState('')

  /**
   * Handle data export
   * Downloads all user data as a ZIP file
   */
  const handleExport = useCallback(async () => {
    setIsExporting(true)
    setExportStatus('idle')
    setExportMessage('')

    try {
      const response = await apiFetch('/api/export')

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Export failed' }))
        throw new Error(error.error || 'Export failed')
      }

      // Get the blob from response
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ragbox_export_${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()

      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setExportStatus('success')
      setExportMessage('Your data has been exported successfully.')
    } catch (error) {
      setExportStatus('error')
      setExportMessage(error instanceof Error ? error.message : 'Failed to export data. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }, [])

  return (
    <motion.main
      className={cn(
        'flex-1 h-screen overflow-y-auto',
        'dark:bg-void bg-ceramic'
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center',
                'dark:bg-electric-600/20 bg-electric-100',
                'dark:text-electric-400 text-electric-600'
              )}
            >
              <Settings className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold dark:text-white text-black">
                Settings
              </h1>
              <p className="text-sm dark:text-white/40 text-black/40 mt-0.5">
                Manage your account and preferences
              </p>
            </div>
          </div>
        </motion.header>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Data Export Section */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              'rounded-2xl p-6',
              'dark:bg-white/5 bg-white',
              'border dark:border-white/10 border-black/5',
              'shadow-sm'
            )}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  'dark:bg-electric-600/20 bg-electric-100',
                  'dark:text-electric-400 text-electric-600'
                )}
              >
                <FileArchive className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold dark:text-white text-black">
                  Export Your Data
                </h2>
                <p className="text-sm dark:text-white/50 text-black/50 mt-1 mb-4">
                  Download all your documents, metadata, and query history in a single ZIP file.
                  No lock-in - your data is always yours.
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <motion.button
                    onClick={handleExport}
                    disabled={isExporting}
                    aria-label={isExporting ? 'Preparing data export' : 'Export all user data'}
                    className={cn(
                      'flex items-center justify-center gap-2 px-6 py-3 rounded-xl',
                      'dark:bg-electric-600 bg-electric-500',
                      'text-white font-semibold',
                      'transition-all duration-200',
                      'hover:shadow-glow',
                      isExporting && 'opacity-50 cursor-not-allowed'
                    )}
                    whileHover={{ scale: isExporting ? 1 : 1.02 }}
                    whileTap={{ scale: isExporting ? 1 : 0.98 }}
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Preparing Export...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        <span>Export All Data</span>
                      </>
                    )}
                  </motion.button>

                  {/* Export status message */}
                  {exportStatus !== 'idle' && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        'flex items-center gap-2 text-sm',
                        exportStatus === 'success' && 'text-green-500',
                        exportStatus === 'error' && 'text-red-500'
                      )}
                    >
                      {exportStatus === 'success' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      <span>{exportMessage}</span>
                    </motion.div>
                  )}
                </div>

                {/* Export details */}
                <div className="mt-4 pt-4 border-t dark:border-white/10 border-black/5">
                  <p className="text-xs dark:text-white/30 text-black/30 mb-2">
                    Export includes:
                  </p>
                  <ul className="grid grid-cols-2 gap-2 text-xs dark:text-white/50 text-black/50">
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full dark:bg-electric-400 bg-electric-500" />
                      All uploaded documents
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full dark:bg-electric-400 bg-electric-500" />
                      Document metadata (JSON)
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full dark:bg-electric-400 bg-electric-500" />
                      Query history
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full dark:bg-electric-400 bg-electric-500" />
                      User profile data
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Account Section */}
          <SettingsSection
            icon={<User className="w-5 h-5" />}
            title="Account"
            description="Manage your account information and preferences"
            delay={0.3}
          >
            <SettingsItem
              label="Email"
              value="user@example.com"
              badge="Verified"
              badgeColor="green"
            />
            <SettingsItem
              label="Account Type"
              value="Partner"
              badge="Pro"
              badgeColor="electric"
            />
            <SettingsItem
              label="Member Since"
              value="January 2026"
            />
          </SettingsSection>

          {/* Security Section */}
          <SettingsSection
            icon={<Shield className="w-5 h-5" />}
            title="Security"
            description="Security settings and authentication options"
            delay={0.4}
          >
            <SettingsItem
              label="Two-Factor Authentication"
              value="Enabled"
              badge="Active"
              badgeColor="green"
            />
            <SettingsItem
              label="Session Timeout"
              value="30 minutes"
            />
            <SettingsItem
              label="Last Password Change"
              value="45 days ago"
            />
          </SettingsSection>

          {/* Storage Section */}
          <SettingsSection
            icon={<Database className="w-5 h-5" />}
            title="Storage"
            description="Document storage and retention settings"
            delay={0.5}
          >
            <SettingsItem
              label="Storage Used"
              value="4.2 GB of 50 GB"
            />
            <SettingsItem
              label="Documents"
              value="24 files"
            />
            <SettingsItem
              label="Encryption"
              value="AES-256 (CMEK)"
              badge="Secure"
              badgeColor="green"
            />
          </SettingsSection>

          {/* Notifications Section */}
          <SettingsSection
            icon={<Bell className="w-5 h-5" />}
            title="Notifications"
            description="Configure how you receive alerts and updates"
            delay={0.6}
          >
            <SettingsItem
              label="Email Notifications"
              value="Enabled"
              isToggle
            />
            <SettingsItem
              label="Query Alerts"
              value="Disabled"
              isToggle
            />
            <SettingsItem
              label="Security Alerts"
              value="Enabled"
              isToggle
            />
          </SettingsSection>

          {/* Privacy Section */}
          <SettingsSection
            icon={<Lock className="w-5 h-5" />}
            title="Privacy"
            description="Data privacy and retention policies"
            delay={0.7}
          >
            <SettingsItem
              label="Audit Log Retention"
              value="7 years (WORM-compliant)"
            />
            <SettingsItem
              label="Data Region"
              value="US-Central1 (GCP)"
            />
            <SettingsItem
              label="Third-Party Sharing"
              value="None"
              badge="Private"
              badgeColor="green"
            />
          </SettingsSection>
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 pt-6 border-t dark:border-white/10 border-black/5"
        >
          <p className="text-xs dark:text-white/30 text-black/30 text-center">
            RAGbox.co - Your data, your control. No lock-in.
          </p>
        </motion.footer>
      </div>
    </motion.main>
  )
}

/**
 * Settings section wrapper component
 */
function SettingsSection({
  icon,
  title,
  description,
  delay,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  delay: number
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        'rounded-2xl p-6',
        'dark:bg-white/5 bg-white',
        'border dark:border-white/10 border-black/5',
        'shadow-sm'
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            'dark:bg-white/10 bg-black/5',
            'dark:text-white/60 text-black/60'
          )}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold dark:text-white text-black">
            {title}
          </h2>
          <p className="text-sm dark:text-white/50 text-black/50 mt-1 mb-4">
            {description}
          </p>
          <div className="space-y-3">
            {children}
          </div>
        </div>
      </div>
    </motion.section>
  )
}

/**
 * Individual settings item component
 */
function SettingsItem({
  label,
  value,
  badge,
  badgeColor,
  isToggle,
}: {
  label: string
  value: string
  badge?: string
  badgeColor?: 'green' | 'electric' | 'amber'
  isToggle?: boolean
}) {
  const colorClasses = {
    green: 'dark:bg-green-500/20 dark:text-green-400 bg-green-100 text-green-600',
    electric: 'dark:bg-electric-600/20 dark:text-electric-400 bg-electric-100 text-electric-600',
    amber: 'dark:bg-amber-500/20 dark:text-amber-400 bg-amber-100 text-amber-600',
  }

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm dark:text-white/70 text-black/70">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm dark:text-white text-black font-medium">{value}</span>
        {badge && badgeColor && (
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              colorClasses[badgeColor]
            )}
          >
            {badge}
          </span>
        )}
        {isToggle && (
          <div
            role="switch"
            aria-checked={value === 'Enabled'}
            aria-label={label}
            tabIndex={0}
            className={cn(
              'w-8 h-4 rounded-full relative cursor-pointer',
              value === 'Enabled'
                ? 'dark:bg-electric-600 bg-electric-500'
                : 'dark:bg-white/20 bg-black/20'
            )}
          >
            <div
              className={cn(
                'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all',
                value === 'Enabled' ? 'right-0.5' : 'left-0.5'
              )}
            />
          </div>
        )}
      </div>
    </div>
  )
}
