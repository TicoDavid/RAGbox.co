'use client'

import { motion } from 'framer-motion'
import { Navbar } from '@/components/Navbar'
import { TheBox } from '@/components/TheBox'
import { PrivilegeCards } from '@/components/PrivilegeCards'
import { cn } from '@/lib/utils'

/**
 * US-001: Landing Page
 *
 * Design System: Sync.so / Linear aesthetic
 * - Clean, professional, premium feel
 * - OLED Void (dark) / Premium Bond Paper (light)
 * - Blue (#2563EB) primary brand color
 * - Rounded buttons and cards
 */
export default function LandingPage() {
  return (
    <main
      className={cn(
        'min-h-screen flex flex-col relative overflow-hidden',
        'bg-white dark:bg-[#050505]',
        'transition-colors duration-300'
      )}
    >
      {/* Background Ambience - SaaS Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={cn(
            'absolute top-0 left-1/2 -translate-x-1/2',
            'w-[600px] h-[400px]',
            'bg-blue-500/20 dark:bg-blue-500/10',
            'blur-[120px] rounded-full'
          )}
        />
      </div>

      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-20 flex flex-col items-center text-center px-4">
        {/* Headlines */}
        <motion.div
          className="max-w-4xl mx-auto space-y-6 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <h1
            className={cn(
              'text-5xl md:text-7xl font-bold tracking-tight',
              'text-slate-900 dark:text-white'
            )}
          >
            Secure Document Intelligence
            <br />
            <span className="text-blue-600 dark:text-blue-500">
              in a Sovereign Environment
            </span>
          </h1>

          <p
            className={cn(
              'text-lg md:text-xl leading-relaxed',
              'text-slate-600 dark:text-slate-400',
              'max-w-2xl mx-auto'
            )}
          >
            A Digital Fort Knox for your confidential documents.
            AI-powered answers grounded in your data, with verifiable citations.
          </p>

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            <span>Zero Training</span>
            <span className="text-blue-500">•</span>
            <span>SOC2 Ready</span>
            <span className="text-blue-500">•</span>
            <span>Private Vaults</span>
          </div>
        </motion.div>

        {/* The Drop Zone */}
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
        >
          <TheBox />

          {/* CTAs - Anchored below the box */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <button
              className={cn(
                'h-12 px-8 rounded-full',
                'bg-blue-600 hover:bg-blue-500',
                'text-white font-semibold',
                'shadow-lg shadow-blue-600/25',
                'transition-all w-full sm:w-auto'
              )}
            >
              Start Free Trial
            </button>
            <button
              className={cn(
                'h-12 px-8 rounded-full',
                'border border-slate-200 dark:border-white/10',
                'text-slate-700 dark:text-white',
                'hover:bg-slate-50 dark:hover:bg-white/10',
                'font-medium transition-all w-full sm:w-auto'
              )}
            >
              See How It Works
            </button>
          </div>
        </motion.div>
      </section>

      {/* Feature Section */}
      <section
        className={cn(
          'py-24 px-6',
          'bg-white dark:bg-[#050505]',
          'transition-colors duration-300'
        )}
      >
        <PrivilegeCards />
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 bg-white dark:bg-[#050505] transition-colors duration-300">
        <div className="max-w-6xl mx-auto flex items-center justify-center">
          <div className="flex items-center gap-8 text-sm text-slate-400 dark:text-slate-600 font-medium">
            <a href="#" className="hover:text-slate-600 dark:hover:text-slate-400 transition-colors">
              Security
            </a>
            <a href="#" className="hover:text-slate-600 dark:hover:text-slate-400 transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-slate-600 dark:hover:text-slate-400 transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
