'use client'

import { motion } from 'framer-motion'
import { Scale, Download, Shield, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AuditTimeline } from '@/components/audit/AuditTimeline'

/**
 * Audit Log Viewer Page - /dashboard/audit
 *
 * "Truth & Audit" - The Veritas ledger
 * Displays immutable audit trail in blockchain-inspired style
 */
export default function AuditPage() {
  return (
    <motion.main
      className={cn(
        'flex-1 h-screen overflow-hidden flex flex-col',
        'dark:bg-void bg-ceramic'
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <header className="flex-shrink-0 px-8 pt-8 pb-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-start justify-between"
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center',
                'dark:bg-electric-600/20 bg-electric-100',
                'dark:text-electric-400 text-electric-600'
              )}
            >
              <Scale className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold dark:text-white text-black">
                Truth & Audit
              </h1>
              <p className="text-sm dark:text-white/40 text-black/40 mt-0.5">
                Immutable ledger of all system activities
              </p>
            </div>
          </div>

          {/* Export button */}
          <motion.button
            className={cn(
              'flex items-center gap-2 px-5 py-3 rounded-xl',
              'dark:bg-electric-600/20 bg-electric-100',
              'dark:text-electric-400 text-electric-600',
              'border dark:border-electric-500/30 border-electric-200',
              'font-semibold text-sm',
              'transition-all duration-200',
              'hover:shadow-glow-sm'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Download className="w-4 h-4" />
            <span>Print Official Ledger</span>
          </motion.button>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-6 mt-6"
        >
          <StatBadge
            icon={<Shield className="w-4 h-4" />}
            label="Integrity"
            value="100%"
            color="green"
          />
          <StatBadge
            icon={<Clock className="w-4 h-4" />}
            label="Retention"
            value="7 Years"
            color="electric"
          />
          <div className="h-6 w-px dark:bg-white/10 bg-black/10" />
          <p className="text-xs dark:text-white/30 text-black/30">
            WORM-compliant • SHA-256 verified • BigQuery backed
          </p>
        </motion.div>
      </header>

      {/* Decorative blockchain line */}
      <div className="flex-shrink-0 px-8">
        <div className="h-px w-full dark:bg-gradient-to-r dark:from-transparent dark:via-electric-500/30 dark:to-transparent bg-gradient-to-r from-transparent via-electric-500/20 to-transparent" />
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-hidden px-8 py-6">
        <AuditTimeline className="h-full" />
      </div>
    </motion.main>
  )
}

/**
 * Stat badge component
 */
function StatBadge({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: 'green' | 'electric' | 'amber'
}) {
  const colorClasses = {
    green: {
      bg: 'dark:bg-green-500/20 bg-green-100',
      text: 'dark:text-green-400 text-green-600',
    },
    electric: {
      bg: 'dark:bg-electric-600/20 bg-electric-100',
      text: 'dark:text-electric-400 text-electric-600',
    },
    amber: {
      bg: 'dark:bg-amber-500/20 bg-amber-100',
      text: 'dark:text-amber-400 text-amber-600',
    },
  }

  const classes = colorClasses[color]

  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', classes.bg, classes.text)}>
        {icon}
      </div>
      <div>
        <p className="text-xs dark:text-white/40 text-black/40">{label}</p>
        <p className={cn('text-sm font-semibold', classes.text)}>{value}</p>
      </div>
    </div>
  )
}
