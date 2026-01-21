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
      'Every action is logged. Who asked what, when, and what answer they received. Audit-ready from day one.',
    tag: 'Veritas Log',
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
            'bg-gradient-to-b from-white to-slate-400'
          )}
        >
          Your Files Speak.
          <br />
          We Make Them Testify.
        </h2>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
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
        // Grok dark card aesthetic
        'bg-neutral-900/50',
        'border border-white/5',
        'hover:border-white/10',
        'hover:bg-neutral-900/70'
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
            'bg-white/5',
            'text-white/60',
            'transition-colors duration-300',
            'group-hover:bg-white/10 group-hover:text-white'
          )}
        >
          {icon}
        </div>
        <span
          className={cn(
            'px-3 py-1.5 rounded-full',
            'text-xs font-medium uppercase tracking-wider',
            'bg-white/5 text-white/40',
            'border border-white/5'
          )}
        >
          {tag}
        </span>
      </div>

      {/* Content */}
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </motion.div>
  )
}
