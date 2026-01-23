'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { TheBox } from '@/components/TheBox'
import { PrivilegeCards } from '@/components/PrivilegeCards'
import { cn } from '@/lib/utils'

/**
 * US-001: Landing Page
 *
 * Design System: "Stark Industries Interface"
 * - Empowering, not intimidating - makes users feel like superheroes
 * - OLED Void (dark) / Premium Bond Paper (light)
 * - Electric Blue (#2563EB) primary brand color
 * - Generous border radiuses (rounded-2xl, rounded-3xl)
 * - Heavy spring physics (stiffness: 300, damping: 30)
 *
 * HIERARCHY (Text First, Box Second):
 * 1. Navbar (Big Logo)
 * 2. H1 Headline (Heavy, "Sovereign Intelligence" gradient)
 * 3. Subhead (Grey/Slate)
 * 4. The Breathing Box (Glassmorphism, Premium feel)
 * 5. Clear CTAs
 */
export default function LandingPage() {
  return (
    <main
      className={cn(
        'min-h-screen flex flex-col relative overflow-hidden',
        // Theme-aware background
        'dark:bg-black bg-white',
        'transition-colors duration-300'
      )}
    >
      {/* Subtle Background Pattern - Constellation Network */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Radial glow behind hero */}
        <div
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-[800px] h-[800px]',
            'dark:bg-electric-600/10 bg-electric-500/5',
            'rounded-full blur-3xl',
            'opacity-60'
          )}
        />
        {/* Mesh gradient overlay */}
        <div
          className={cn(
            'absolute inset-0',
            'dark:bg-gradient-to-b dark:from-transparent dark:via-black/50 dark:to-black',
            'bg-gradient-to-b from-transparent via-white/50 to-white'
          )}
        />
      </div>

      {/* Glass Navbar */}
      <Navbar />

      {/* Hero Section - The Sovereign Zone */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-16 min-h-[85vh]">
        {/* Tagline - Pulled up for prominence */}
        <motion.p
          className={cn(
            'text-sm md:text-base font-semibold uppercase tracking-widest mb-6',
            'text-transparent bg-clip-text',
            'dark:bg-gradient-to-r dark:from-electric-400 dark:to-electric-600',
            'bg-gradient-to-r from-electric-500 to-electric-700'
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
        >
          Your Files Speak. We Make Them Testify.
        </motion.p>

        {/* H1 Headline - Softened, Empowering */}
        <motion.h1
          className={cn(
            'text-4xl sm:text-5xl md:text-6xl lg:text-7xl',
            'font-extrabold text-center mb-6',
            'dark:text-white text-slate-900'
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
        >
          Secure Document Intelligence
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-400 via-electric-500 to-electric-600">
            in a Sovereign Environment
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className={cn(
            'text-lg md:text-xl lg:text-2xl text-center mb-4',
            'dark:text-slate-400 text-slate-600',
            'max-w-2xl'
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.15 }}
        >
          A Digital Fort Knox for your confidential documents.
          <br className="hidden sm:block" />
          AI-powered answers grounded in your data, with verifiable citations.
        </motion.p>

        {/* Value Prop - Zero Training Emphasis */}
        <motion.p
          className={cn(
            'text-sm md:text-base text-center mb-12',
            'dark:text-slate-500 text-slate-500',
            'max-w-xl'
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.18 }}
        >
          Zero training required. Instant analysis. Enterprise-grade security.
        </motion.p>

        {/* The Box - Central Element */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.2 }}
        >
          <TheBox />
        </motion.div>

        {/* CTAs - Clearer, More Accessible */}
        <motion.div
          className="flex flex-col sm:flex-row items-center gap-4 mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.3 }}
        >
          <Link
            href="/dashboard"
            className={cn(
              'px-8 py-4 rounded-2xl',
              'text-base font-semibold',
              'bg-electric-600 hover:bg-electric-500',
              'text-white',
              'shadow-glow-sm hover:shadow-glow',
              'transition-all duration-200'
            )}
          >
            Start Free Trial
          </Link>
          <button
            className={cn(
              'px-6 py-3 rounded-2xl',
              'text-sm font-medium',
              // Improved contrast for accessibility
              'dark:text-white/70 dark:hover:text-white',
              'text-slate-700 hover:text-slate-900',
              'dark:border dark:border-white/20 dark:hover:border-white/40',
              'border border-slate-300 hover:border-slate-400',
              'dark:hover:bg-white/5 hover:bg-slate-50',
              'transition-all duration-200'
            )}
          >
            See How It Works
          </button>
        </motion.div>
      </section>

      {/* Feature Section - The 4 Pillars */}
      <section
        className={cn(
          'py-24',
          'dark:bg-black bg-slate-50',
          'dark:border-t dark:border-white/5 border-t border-black/5',
          'transition-colors duration-300'
        )}
      >
        <PrivilegeCards />
      </section>

      {/* Ghost Footer - Barely visible */}
      <footer className="px-6 py-8 dark:bg-black bg-white transition-colors duration-300">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo - Ghost opacity */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <img
              src="https://storage.googleapis.com/connexusai-assets/WhiteLogo_RAGbox.co-removebg-preview.png"
              alt="RAGbox"
              className="h-12 w-auto opacity-20 dark:invert-0 invert"
            />
          </motion.div>

          {/* Ghost Links - theme-aware muted colors */}
          <div className="flex items-center gap-8 text-sm dark:text-neutral-700 text-neutral-400 font-medium">
            <a
              href="#"
              className="dark:hover:text-neutral-500 hover:text-neutral-600 transition-colors"
            >
              Security
            </a>
            <a
              href="#"
              className="dark:hover:text-neutral-500 hover:text-neutral-600 transition-colors"
            >
              Privacy
            </a>
            <a
              href="#"
              className="dark:hover:text-neutral-500 hover:text-neutral-600 transition-colors"
            >
              Terms
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
