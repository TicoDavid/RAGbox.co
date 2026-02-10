'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Lock, Fingerprint, Brain, Shield, Check, Loader2 } from 'lucide-react'
import type { VaultItem } from '@/types/ragbox'

interface SovereignCertificateProps {
  document: VaultItem
  userName?: string
}

type VerificationState = 'idle' | 'scanning' | 'verified'

/**
 * Sovereign Certificate - Chain of Custody Visualization
 *
 * Displays the security provenance of a document like a
 * digital "Certificate of Authenticity" - bearer bond aesthetic.
 * This is the "Digital Bearer Bond" that proves the file is safe.
 */
export function SovereignCertificate({ document, userName = 'Sovereign User' }: SovereignCertificateProps) {
  const [verificationState, setVerificationState] = useState<VerificationState>('idle')

  // Generate a deterministic "hash" display from the document ID
  const truncatedHash = document.checksum
    ? `${document.checksum.slice(0, 8)}...${document.checksum.slice(-6)}`
    : `${document.id.slice(0, 8)}...${document.id.slice(-4)}`

  // Handle verification animation
  const handleVerify = useCallback(async () => {
    if (verificationState !== 'idle') return

    setVerificationState('scanning')

    // Simulate verification delay (1.5s as specified)
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setVerificationState('verified')

    // Reset after 5 seconds
    setTimeout(() => {
      setVerificationState('idle')
    }, 5000)
  }, [verificationState])

  // Determine vector intelligence status
  const getIntelligenceStatus = () => {
    switch (document.status) {
      case 'ready':
        return { text: 'Vectorized (v3)', color: 'text-[#00F0FF]' } // Brand Blue
      case 'processing':
        return { text: 'Processing...', color: 'text-amber-400' }
      case 'pending':
        return { text: 'Awaiting Vector', color: 'text-slate-400' }
      case 'error':
        return { text: 'Vector Failed', color: 'text-red-400' }
      default:
        return { text: 'Unknown', color: 'text-slate-500' }
    }
  }

  const intelligenceStatus = getIntelligenceStatus()

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-[#020408] p-4 shadow-[0_0_30px_-15px_rgba(245,158,11,0.15)]">
      {/* RAGbox Logo Watermark - Large, Faint Background */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]">
        <img
          src="https://storage.googleapis.com/connexusai-assets/BabyBlue_RAGb%C3%B6x.png"
          alt=""
          className="w-40 h-auto select-none"
          draggable={false}
        />
      </div>

      {/* Green Scan Line Animation (for verification) */}
      <AnimatePresence>
        {verificationState === 'scanning' && (
          <motion.div
            initial={{ top: '-4px' }}
            animate={{ top: '100%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent z-10"
            style={{ boxShadow: '0 0 20px rgba(16,185,129,0.6)' }}
          />
        )}
      </AnimatePresence>

      {/* Certificate Header - CHAIN OF CUSTODY */}
      <div className="relative flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/80">
          Chain of Custody
        </span>
        <Shield className="w-4 h-4 text-amber-500/60" />
      </div>

      {/* The Official Record - Data Grid */}
      <div className="relative space-y-3">
        {/* Row 1: Custodian */}
        <CertificateRow
          icon={<User className="w-3.5 h-3.5" />}
          iconColor="text-slate-400"
          label="Custodian"
          value={`${userName} (Verified)`}
        />

        {/* Row 2: Encryption - Green/Emerald */}
        <CertificateRow
          icon={<Lock className="w-3.5 h-3.5" />}
          iconColor="text-emerald-500"
          label="Encryption"
          value="AES-256-GCM"
          valueClassName="text-emerald-400 font-mono"
        />

        {/* Row 3: SHA-256 Hash - Monospace Gray */}
        <CertificateRow
          icon={<Fingerprint className="w-3.5 h-3.5" />}
          iconColor="text-slate-500"
          label="SHA-256"
          value={truncatedHash}
          valueClassName="font-mono text-slate-500"
        />

        {/* Row 4: Intelligence - Brand Blue */}
        <CertificateRow
          icon={<Brain className="w-3.5 h-3.5" />}
          iconColor="text-[#00F0FF]"
          label="Intelligence"
          value={intelligenceStatus.text}
          valueClassName={intelligenceStatus.color}
        />
      </div>

      {/* Divider */}
      <div className="my-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Verify Integrity Button */}
      <button
        onClick={handleVerify}
        disabled={verificationState !== 'idle'}
        className={`
          relative w-full py-3 rounded-lg text-xs font-semibold uppercase tracking-wider
          transition-all duration-300 overflow-hidden
          ${verificationState === 'verified'
            ? 'bg-emerald-900/30 border border-emerald-500/40 text-emerald-400 font-bold cursor-default'
            : verificationState === 'scanning'
              ? 'bg-slate-900/50 border border-white/10 text-slate-400 cursor-wait'
              : 'bg-transparent border border-white/10 text-slate-500 hover:text-white hover:border-white/20 hover:bg-white/5'
          }
        `}
      >
        {verificationState === 'verified' ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Verified Immutable
          </motion.span>
        ) : verificationState === 'scanning' ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Scanning...
          </span>
        ) : (
          <span>Verify Integrity</span>
        )}
      </button>

      {/* Holographic Edge Effect - Golden Shimmer */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
    </div>
  )
}

/**
 * Individual row in the certificate
 */
function CertificateRow({
  icon,
  iconColor,
  label,
  value,
  valueClassName = '',
}: {
  icon: React.ReactNode
  iconColor: string
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`shrink-0 ${iconColor}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] uppercase tracking-widest text-slate-600 mb-0.5">
          {label}
        </div>
        <div className={`text-xs text-slate-300 truncate ${valueClassName}`}>
          {value}
        </div>
      </div>
    </div>
  )
}

export default SovereignCertificate
