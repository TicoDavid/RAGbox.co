'use client'

import { motion } from 'framer-motion'
import { Sidebar } from '@/components/Sidebar'
import { Vault } from '@/components/Vault'
import { Mercury } from '@/components/Mercury'

/**
 * Dashboard Page - The Trinity Grid Layout
 *
 * Layout:
 * 1. Left Sidebar (Navigation) - 256px fixed
 * 2. Center Stage (The Vault) - Flexible, scrollable
 * 3. Right Sidebar (Mercury Chat) - 320px fixed
 *
 * Design: "Grok Meets Fort Knox"
 * - Pure OLED Black (dark) / Ceramic White (light)
 * - Electric Blue accents
 * - Glassmorphism on Mercury
 */
export default function DashboardPage() {
  return (
    <motion.div
      className="flex h-screen overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Left Sidebar - Navigation */}
      <Sidebar />

      {/* Center Stage - The Vault */}
      <Vault />

      {/* Right Sidebar - Mercury AI Concierge */}
      <Mercury />
    </motion.div>
  )
}
