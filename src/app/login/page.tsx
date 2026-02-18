'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, KeyRound } from 'lucide-react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [betaCode, setBetaCode] = useState('')
  const [codeError, setCodeError] = useState('')

  const storeBetaCode = () => {
    if (typeof window !== 'undefined' && betaCode.trim()) {
      sessionStorage.setItem('ragbox_beta_code', betaCode.trim().toUpperCase())
    }
  }

  const handleGoogleAuth = () => {
    if (!betaCode.trim()) {
      setCodeError('Please enter your access code')
      return
    }
    setCodeError('')
    storeBetaCode()
    signIn('google', { callbackUrl: '/dashboard' })
  }

  const handleMicrosoftAuth = () => {
    if (!betaCode.trim()) {
      setCodeError('Please enter your access code')
      return
    }
    setCodeError('')
    storeBetaCode()
    signIn('azure-ad', { callbackUrl: '/dashboard' })
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBetaCode(e.target.value.toUpperCase())
    if (codeError) setCodeError('')
  }

  return (
    <main className="min-h-screen bg-void flex items-center justify-center p-6 relative overflow-hidden">
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        <motion.div
          className="relative"
          animate={{ scale: [1, 1.05, 1], opacity: [0.03, 0.06, 0.03] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Shield className="w-[600px] h-[600px] text-electric-600" strokeWidth={0.5} />
        </motion.div>
        {[1, 2, 3].map((ring) => (
          <motion.div
            key={ring}
            className="absolute rounded-full border border-electric-600/10"
            style={{ width: ring * 150 + 300 + 'px', height: ring * 150 + 300 + 'px' }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.05, 0.1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: ring * 0.3 }}
          />
        ))}
      </motion.div>

      <motion.div
        className={cn('relative z-10 w-full max-w-md p-8 rounded-3xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-[0_0_60px_-15px_rgba(37,99,235,0.3)]')}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.2 }}
      >
        <motion.div className="flex justify-center mb-8" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <img src="https://storage.googleapis.com/connexusai-assets/BabyBlue_RAGb%C3%B6x.png" alt="RAGbox.co" className="h-48 w-auto" />
        </motion.div>

        <motion.div className="text-center mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Authenticate to Access Vault</h1>
          <p className="text-sm text-white/40">Your documents await. Verify your identity to proceed.</p>
        </motion.div>

        {/* Beta Access Code Entry */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="w-4 h-4 text-electric-400" />
            <h2 className="text-sm font-semibold text-white/80 tracking-wide">Enter Your Access Code</h2>
          </div>
          <input
            type="text"
            value={betaCode}
            onChange={handleCodeChange}
            placeholder="RBX-LEGAL-XXXXXX"
            className={cn(
              'w-full px-4 py-3.5 rounded-2xl bg-white/5 border text-white text-sm font-mono tracking-widest text-center',
              'placeholder:text-white/20 placeholder:tracking-widest',
              'focus:outline-none focus:ring-2 focus:ring-electric-500/50 focus:border-electric-500/50',
              'transition-all duration-200',
              codeError
                ? 'border-red-500/50'
                : 'border-white/10 hover:border-white/20'
            )}
            autoComplete="off"
            spellCheck={false}
          />
          {codeError && (
            <p className="text-xs text-red-400 mt-1.5 text-center">{codeError}</p>
          )}
          <p className="text-xs text-white/30 mt-2 text-center">
            Don&apos;t have a code?{' '}
            <a
              href="https://ragbox.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-electric-400 hover:text-electric-300 underline underline-offset-2 transition-colors"
            >
              Apply at ragbox.co
            </a>
          </p>
        </motion.div>

        <motion.div className="space-y-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <motion.button onClick={handleGoogleAuth} className={cn('w-full flex items-center justify-center gap-3 px-6 py-4 rounded-full bg-white text-black font-medium transition-all duration-200 hover:bg-white/90 hover:shadow-lg active:scale-[0.98]')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Continue with Google</span>
          </motion.button>

          <motion.button onClick={handleMicrosoftAuth} className={cn('w-full flex items-center justify-center gap-3 px-6 py-4 rounded-full bg-white text-black font-medium transition-all duration-200 hover:bg-white/90 hover:shadow-lg active:scale-[0.98]')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#FFB900" d="M13 13h10v10H13z"/>
            </svg>
            <span>Continue with Microsoft</span>
          </motion.button>
        </motion.div>

        <motion.div className="text-center mt-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          <Link href="/" className="text-sm text-white/40 hover:text-white/60 transition-colors">Back to landing page</Link>
        </motion.div>

        <motion.div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-white/5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
          <Shield className="w-4 h-4 text-electric-500"/><span className="text-xs text-white/30">Zero Data Exfiltration Guarantee</span>
        </motion.div>
      </motion.div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-electric-500/20 to-transparent" initial={{ top: '0%' }} animate={{ top: '100%' }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}/>
      </div>
    </main>
  )
}
