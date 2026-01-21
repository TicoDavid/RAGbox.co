'use client'

import { motion } from 'framer-motion'
import { Navbar } from '@/components/Navbar'
import { TheBox } from '@/components/TheBox'
import { PrivilegeCards } from '@/components/PrivilegeCards'
import { cn } from '@/lib/utils'

/**
 * US-001: Landing Page
 *
 * Design System: "Cupertino Fort Knox"
 * - As secure as a bank vault, as intuitive as an Apple product
 * - OLED Void (dark) / Premium Bond Paper (light)
 * - Electric Blue (#2563EB) primary brand color
 * - Generous border radiuses (rounded-2xl, rounded-3xl)
 * - Heavy spring physics (stiffness: 300, damping: 30)
 *
 * HIERARCHY (Text First, Box Second):
 * 1. Navbar (Big Logo)
 * 2. H1 Headline (Heavy, "Sovereign Environment" gradient)
 * 3. Subhead (Grey/Slate)
 * 4. The Breathing Box (Glowing, Heavy Stroke)
 * 5. "See How It Works" Button
 */
export default function LandingPage() {
  return (
    <main
      className={cn(
        'min-h-screen flex flex-col',
        'transition-colors duration-300',
        // OLED Void - Dark mode
        'dark:bg-void',
        // Premium Bond Paper - Light mode
        'bg-paper'
      )}
    >
      {/* Glass Navbar */}
      <Navbar />

      {/* Hero Section - The Sovereign Zone */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-16 min-h-[85vh]">
        {/* Trust Badge */}
        <motion.div
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 mb-8',
            'rounded-full',
            'dark:bg-white/5 dark:border dark:border-white/10',
            'bg-white/60 border border-black/5',
            'backdrop-blur-sm'
          )}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="w-2 h-2 rounded-full bg-trust-high animate-pulse" />
          <span className="text-sm dark:text-slate-300 text-slate-600">
            Zero Data Exfiltration Guarantee
          </span>
        </motion.div>

        {/* FLIPPED HIERARCHY: H1 Headline ABOVE TheBox */}
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
          Document Interrogation
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-400 via-electric-500 to-electric-600">
            in a Sovereign Environment
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className={cn(
            'text-lg md:text-xl lg:text-2xl text-center mb-12',
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

        {/* The Box - Central Element (Now BELOW the headline) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.2 }}
        >
          <TheBox />
        </motion.div>

        {/* Secondary CTA */}
        <motion.button
          className={cn(
            'mt-12 px-6 py-3 rounded-2xl',
            'text-sm font-medium',
            'dark:text-slate-400 dark:hover:text-white',
            'text-slate-600 hover:text-slate-900',
            'dark:border dark:border-white/10 dark:hover:border-white/20',
            'border border-black/10 hover:border-black/20',
            'transition-all duration-200'
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.3 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          See How It Works
        </motion.button>
      </section>

      {/* Feature Section - Privilege Controls */}
      <section
        className={cn(
          'py-24',
          'dark:bg-void-card/50 bg-paper-muted/50',
          'border-t dark:border-white/5 border-black/5'
        )}
      >
        <PrivilegeCards />
      </section>

      {/* Footer */}
      <footer
        className={cn(
          'px-6 py-8',
          'border-t dark:border-white/5 border-black/5'
        )}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <img
              src="https://storage.googleapis.com/connexusai-assets/WhiteLogo_RAGbox.co-removebg-preview.png"
              alt="RAGbox"
              className={cn(
                'h-32 w-auto opacity-50',
                'dark:brightness-100 brightness-0'
              )}
            />
          </motion.div>

          {/* Tagline */}
          <p className="text-sm dark:text-slate-500 text-slate-400">
            Sovereign document intelligence for professionals who can't afford to compromise.
          </p>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm dark:text-slate-500 text-slate-400">
            <a
              href="#"
              className="hover:dark:text-slate-300 hover:text-slate-600 transition-colors"
            >
              Privacy
            </a>
            <a
              href="#"
              className="hover:dark:text-slate-300 hover:text-slate-600 transition-colors"
            >
              Terms
            </a>
            <a
              href="#"
              className="hover:dark:text-slate-300 hover:text-slate-600 transition-colors"
            >
              Security
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
