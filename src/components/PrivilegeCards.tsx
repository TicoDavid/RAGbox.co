'use client'

import { motion } from 'framer-motion'
import { Shield, Users, Database, MessageSquareOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PrivilegeCard {
  icon: React.ReactNode
  title: string
  description: string
  highlight: string
}

const privileges: PrivilegeCard[] = [
  {
    icon: <Shield className="w-6 h-6" strokeWidth={2.5} />,
    title: 'Confidence Gate',
    description:
      "If RAGbox can't answer with 85%+ confidence, it refuses rather than speculates. Silence is safer than speculation.",
    highlight: '0.85 threshold',
  },
  {
    icon: <Users className="w-6 h-6" strokeWidth={2.5} />,
    title: 'Role-Based Access',
    description:
      'Partners, Associates, and Auditors each see exactly what they need. Zero-trust by default.',
    highlight: '3 distinct roles',
  },
  {
    icon: <Database className="w-6 h-6" strokeWidth={2.5} />,
    title: 'Document Vault',
    description:
      'Upload up to 1,000 documents per vault. Query across all of them simultaneously.',
    highlight: '1,000 docs / 50GB',
  },
  {
    icon: <MessageSquareOff className="w-6 h-6" strokeWidth={2.5} />,
    title: 'Graceful Refusal',
    description:
      "When the system can't help, it says so clearly and calmly. No alarming error messages.",
    highlight: 'Trust-first UX',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
} as const

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 30,
    },
  },
}

/**
 * Privilege Cards Component
 *
 * Glassmorphism cards displaying RAGbox value propositions
 * Features:
 * - bg-white/5 (dark) or bg-white/60 (light) with 1px border
 * - Staggered entrance animation
 * - Heavy spring physics
 */
export function PrivilegeCards() {
  return (
    <section className="w-full max-w-6xl mx-auto px-6">
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <h2
          className={cn(
            'text-3xl md:text-4xl font-bold mb-4',
            'dark:text-white text-slate-900'
          )}
        >
          Built for High-Stakes Professionals
        </h2>
        <p className="text-lg dark:text-slate-400 text-slate-600 max-w-2xl mx-auto">
          Attorneys, compliance officers, and financial analysts trust RAGbox to
          interrogate their most sensitive documents.
        </p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
      >
        {privileges.map((privilege, index) => (
          <GlassCard key={index} {...privilege} />
        ))}
      </motion.div>
    </section>
  )
}

function GlassCard({ icon, title, description, highlight }: PrivilegeCard) {
  return (
    <motion.div
      className={cn(
        'relative group',
        'p-8 rounded-3xl',
        'transition-all duration-300',
        // Glassmorphism - Dark mode
        'dark:bg-white/5 dark:border dark:border-white/10',
        'dark:hover:bg-white/10 dark:hover:border-electric-500/30',
        // Glassmorphism - Light mode
        'bg-white/60 border border-black/5',
        'hover:bg-white/80 hover:border-electric-500/20',
        // Backdrop blur
        'backdrop-blur-sm',
        // Shadow
        'dark:shadow-none shadow-soft',
        'hover:shadow-soft-lg'
      )}
      variants={cardVariants}
      whileHover={{
        scale: 1.02,
        transition: { type: 'spring', stiffness: 300, damping: 30 },
      }}
    >
      {/* Highlight badge */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            'p-3 rounded-2xl',
            'dark:bg-electric-500/10 bg-electric-100',
            'dark:text-electric-400 text-electric-600',
            'transition-colors duration-300',
            'group-hover:dark:bg-electric-500/20 group-hover:bg-electric-200'
          )}
        >
          {icon}
        </div>
        <span
          className={cn(
            'px-3 py-1.5 rounded-full',
            'text-xs font-medium',
            'dark:bg-electric-500/10 dark:text-electric-400',
            'bg-electric-100 text-electric-700',
            'border dark:border-electric-500/20 border-electric-200'
          )}
        >
          {highlight}
        </span>
      </div>

      {/* Content */}
      <h3
        className={cn(
          'text-xl font-semibold mb-3',
          'dark:text-white text-slate-900'
        )}
      >
        {title}
      </h3>
      <p className="dark:text-slate-400 text-slate-600 leading-relaxed">
        {description}
      </p>

      {/* Hover glow effect */}
      <div
        className={cn(
          'absolute inset-0 rounded-3xl',
          'opacity-0 group-hover:opacity-100',
          'transition-opacity duration-300',
          'bg-gradient-to-br from-electric-500/5 to-transparent',
          'pointer-events-none'
        )}
      />
    </motion.div>
  )
}
