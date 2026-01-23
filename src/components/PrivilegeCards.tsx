'use client'

import { motion } from 'framer-motion'
import { BrainCircuit, ToggleRight, ShieldBan, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PillarCard {
  icon: React.ReactNode
  title: string
  description: string
  tag: string
}

const pillars: PillarCard[] = [
  {
    icon: <BrainCircuit className="w-6 h-6" strokeWidth={2} />,
    title: 'The Silence Protocol',
    description:
      "If RAGbox isn't sure, it says so. No guessing. No fabricating. If the answer isn't in your documents, you'll know.",
    tag: 'Anti-Hallucination',
  },
  {
    icon: <ToggleRight className="w-6 h-6 text-red-500" strokeWidth={2} />,
    title: 'The Privilege Switch',
    description:
      'Flip one switch and privileged documents become invisible to everyone except those who need to see them.',
    tag: 'Role-Based',
  },
  {
    icon: <ShieldBan className="w-6 h-6" strokeWidth={2} />,
    title: 'Digital Fort Knox',
    description:
      "Your documents stay yours. We don't keep copies. We don't train on your data. When you delete it, it's gone.",
    tag: 'Zero-Retention',
  },
  {
    icon: <ScrollText className="w-6 h-6" strokeWidth={2} />,
    title: 'The Unalterable Record',
    description:
      'Every query and document access is cryptographically hashed and logged. SEC 17a-4 ready audit trails.',
    tag: 'Veritas Protocol',
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
 * Privilege Cards Component - The 4 Pillars
 *
 * "Aggressive Competence" tone
 * Grok dark card aesthetic (bg-neutral-900/50, border-white/5)
 */
export function PrivilegeCards() {
  return (
    <section className="w-full max-w-6xl mx-auto px-6">
      {/* New Headline - Aggressive Competence */}
      <motion.div
        className="text-center mb-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <h2
          className={cn(
            'text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6',
            'text-transparent bg-clip-text',
            'dark:bg-gradient-to-b dark:from-white dark:to-slate-400',
            'bg-gradient-to-b from-slate-900 to-slate-600'
          )}
        >
          Your Files Speak.
          <br />
          We Make Them Testify.
        </h2>
        <p className="text-lg md:text-xl dark:text-slate-300 text-slate-700 max-w-2xl mx-auto">
          Analyze your vault like a team of experts—without the team.
          <br />
          Reliable. Repeatable. Effortless.
        </p>
      </motion.div>

      {/* The 4 Pillars Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
      >
        {pillars.map((pillar, index) => (
          <PillarCardComponent key={index} {...pillar} />
        ))}
      </motion.div>
    </section>
  )
}

function PillarCardComponent({ icon, title, description, tag }: PillarCard) {
  return (
    <motion.div
      className={cn(
        'relative group',
        'p-8 rounded-3xl',
        'transition-all duration-300',
        // Elevated surface: stands out from pure black background
        'dark:bg-[#0F0F0F] bg-white',
        // Subtle border for definition
        'dark:border dark:border-white/10 border border-slate-200',
        'dark:hover:border-white/20 hover:border-slate-300',
        'dark:hover:bg-[#141414] hover:bg-slate-50',
        'shadow-md dark:shadow-none'
      )}
      variants={cardVariants}
      whileHover={{
        scale: 1.02,
        transition: { type: 'spring', stiffness: 300, damping: 30 },
      }}
    >
      {/* Tag */}
      <div className="flex items-start justify-between mb-6">
        <div
          className={cn(
            'p-3 rounded-2xl',
            'dark:bg-white/10 bg-slate-100',
            'dark:text-white/80 text-slate-600',
            'transition-colors duration-300',
            'dark:group-hover:bg-electric-600/20 dark:group-hover:text-electric-400',
            'group-hover:bg-electric-100 group-hover:text-electric-600'
          )}
        >
          {icon}
        </div>
        <span
          className={cn(
            'px-3 py-1.5 rounded-full',
            'text-xs font-semibold uppercase tracking-wider',
            // High contrast tags
            'dark:bg-white/10 dark:text-white/80',
            'bg-slate-200 text-slate-700',
            'dark:border dark:border-white/10 border border-slate-300'
          )}
        >
          {tag}
        </span>
      </div>

      {/* Content */}
      <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-3">{title}</h3>
      <p className="dark:text-slate-300 text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  )
}
