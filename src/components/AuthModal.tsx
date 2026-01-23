'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Shield, Mail, Lock, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

type AuthStep = 'credentials' | 'otp'

/**
 * AuthModal Component - Dark/Cinematic Auth Dialog
 *
 * Flow:
 * 1. Credentials step (email/password or OAuth)
 * 2. OTP verification step
 * 3. Redirect to /dashboard on success
 *
 * Design: "App Icon" style logo protection
 * - Blue logo sits inside a white rounded square container
 * - Guarantees 100% brand visibility against dark background
 */
export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<AuthStep>('credentials')
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setIsLoading(true)
    // Simulate sending OTP
    setTimeout(() => {
      setIsLoading(false)
      setStep('otp')
    }, 800)
  }

  const handleGoogleAuth = () => {
    setIsLoading(true)
    // Simulate OAuth flow
    setTimeout(() => {
      setIsLoading(false)
      router.push('/dashboard')
    }, 1000)
  }

  const handleMicrosoftAuth = () => {
    setIsLoading(true)
    // Simulate OAuth flow
    setTimeout(() => {
      setIsLoading(false)
      router.push('/dashboard')
    }, 1000)
  }

  const handleVerifyOTP = () => {
    if (otpCode.length !== 6) return

    setIsLoading(true)
    // Simulate OTP verification
    setTimeout(() => {
      setIsLoading(false)
      router.push('/dashboard')
    }, 800)
  }

  const handleBack = () => {
    setStep('credentials')
    setOtpCode('')
  }

  const resetModal = () => {
    setStep('credentials')
    setEmail('')
    setPassword('')
    setOtpCode('')
    setIsLoading(false)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              'relative w-full max-w-[420px]',
              'bg-[#0A0A0A] border border-white/10 rounded-3xl',
              'overflow-hidden shadow-2xl',
              'shadow-[0_0_60px_-15px_rgba(37,99,235,0.2)]'
            )}
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className={cn(
                'absolute top-4 right-4 z-10',
                'w-8 h-8 rounded-full',
                'flex items-center justify-center',
                'bg-white/5 hover:bg-white/10',
                'text-white/40 hover:text-white/80',
                'transition-all duration-200'
              )}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Back Button (OTP step only) */}
            {step === 'otp' && (
              <button
                onClick={handleBack}
                className={cn(
                  'absolute top-4 left-4 z-10',
                  'w-8 h-8 rounded-full',
                  'flex items-center justify-center',
                  'bg-white/5 hover:bg-white/10',
                  'text-white/40 hover:text-white/80',
                  'transition-all duration-200'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <AnimatePresence mode="wait">
              {step === 'credentials' ? (
                <motion.div
                  key="credentials"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Header Section */}
                  <div className="p-10 text-center">
                    {/* LOGO CONTAINER: The "App Icon" Style */}
                    <motion.div
                      className={cn(
                        'inline-flex items-center justify-center',
                        'w-20 h-20 rounded-2xl',
                        'bg-white shadow-lg shadow-blue-900/20',
                        'mb-6'
                      )}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 30 }}
                    >
                      <img
                        src="https://storage.googleapis.com/connexusai-assets/BlueLogo_RAGbox.co.png"
                        className="w-16 h-auto"
                        alt="RAGbox Logo"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src =
                            'https://storage.googleapis.com/connexusai-assets/WhiteLogo_RAGbox.co-removebg-preview.png'
                          target.classList.add('invert')
                        }}
                      />
                    </motion.div>

                    {/* Title */}
                    <motion.h2
                      className="text-2xl font-bold text-white mb-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      {isLogin ? 'Initialize Access' : 'Create Account'}
                    </motion.h2>

                    <motion.p
                      className="text-sm text-white/40"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      {isLogin
                        ? 'Authenticate to enter the vault'
                        : 'Join the sovereign document environment'}
                    </motion.p>
                  </div>

                  {/* Auth Form */}
                  <div className="px-10 pb-10">
                    {/* OAuth Buttons */}
                    <motion.div
                      className="space-y-3 mb-6"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                    >
                      {/* Google Button */}
                      <button
                        onClick={handleGoogleAuth}
                        disabled={isLoading}
                        className={cn(
                          'w-full flex items-center justify-center gap-3',
                          'px-6 py-3.5 rounded-2xl',
                          'bg-white text-black',
                          'font-medium text-sm',
                          'transition-all duration-200',
                          'hover:bg-white/90 hover:shadow-lg',
                          'active:scale-[0.98]',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </button>

                      {/* Microsoft Button */}
                      <button
                        onClick={handleMicrosoftAuth}
                        disabled={isLoading}
                        className={cn(
                          'w-full flex items-center justify-center gap-3',
                          'px-6 py-3.5 rounded-2xl',
                          'bg-white text-black',
                          'font-medium text-sm',
                          'transition-all duration-200',
                          'hover:bg-white/90 hover:shadow-lg',
                          'active:scale-[0.98]',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#F25022" d="M1 1h10v10H1z" />
                          <path fill="#00A4EF" d="M1 13h10v10H1z" />
                          <path fill="#7FBA00" d="M13 1h10v10H13z" />
                          <path fill="#FFB900" d="M13 13h10v10H13z" />
                        </svg>
                        <span>Continue with Microsoft</span>
                      </button>
                    </motion.div>

                    {/* Divider */}
                    <motion.div
                      className="flex items-center gap-4 mb-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-xs text-white/30 uppercase tracking-wider">or</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </motion.div>

                    {/* Email/Password Form */}
                    <motion.form
                      onSubmit={handleSubmit}
                      className="space-y-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                    >
                      {/* Email Input */}
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email address"
                          disabled={isLoading}
                          className={cn(
                            'w-full pl-11 pr-4 py-3.5 rounded-2xl',
                            'bg-white/5 border border-white/10',
                            'text-white placeholder:text-white/30',
                            'focus:outline-none focus:border-blue-500/50',
                            'focus:ring-2 focus:ring-blue-500/20',
                            'transition-all duration-200',
                            'disabled:opacity-50'
                          )}
                        />
                      </div>

                      {/* Password Input */}
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          disabled={isLoading}
                          className={cn(
                            'w-full pl-11 pr-12 py-3.5 rounded-2xl',
                            'bg-white/5 border border-white/10',
                            'text-white placeholder:text-white/30',
                            'focus:outline-none focus:border-blue-500/50',
                            'focus:ring-2 focus:ring-blue-500/20',
                            'transition-all duration-200',
                            'disabled:opacity-50'
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={isLoading || !email || !password}
                        className={cn(
                          'w-full py-3.5 rounded-2xl',
                          'bg-blue-600 hover:bg-blue-500',
                          'text-white font-semibold',
                          'shadow-[0_0_20px_rgba(37,99,235,0.3)]',
                          'hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]',
                          'transition-all duration-200',
                          'active:scale-[0.98]',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          'flex items-center justify-center gap-2'
                        )}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Sending Code...</span>
                          </>
                        ) : (
                          <span>{isLogin ? 'Continue' : 'Create Account'}</span>
                        )}
                      </button>
                    </motion.form>

                    {/* Toggle Login/Signup */}
                    <motion.p
                      className="text-center text-sm text-white/40 mt-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      {isLogin ? "Don't have an account? " : 'Already have an account? '}
                      <button
                        type="button"
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      >
                        {isLogin ? 'Sign up' : 'Sign in'}
                      </button>
                    </motion.p>

                    {/* Trust Badge */}
                    <motion.div
                      className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-white/5"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.45 }}
                    >
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span className="text-xs text-white/30">
                        Zero Data Exfiltration Guarantee
                      </span>
                    </motion.div>
                  </div>
                </motion.div>
              ) : (
                /* OTP VERIFICATION STEP */
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="p-10"
                >
                  {/* Header */}
                  <div className="text-center mb-8">
                    <motion.div
                      className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-6"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Shield className="w-8 h-8 text-blue-500" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-white mb-2">Verify Identity</h2>
                    <p className="text-sm text-white/40">
                      Enter the 6-digit code sent to
                      <br />
                      <span className="text-white/60">{email}</span>
                    </p>
                  </div>

                  {/* OTP Input */}
                  <div className="mb-6">
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                        setOtpCode(value)
                      }}
                      placeholder="000000"
                      maxLength={6}
                      className={cn(
                        'w-full py-4 px-6 rounded-2xl text-center',
                        'bg-white/5 border border-white/10',
                        'text-white text-2xl font-mono tracking-[0.5em]',
                        'placeholder:text-white/20 placeholder:tracking-[0.5em]',
                        'focus:outline-none focus:border-blue-500/50',
                        'focus:ring-2 focus:ring-blue-500/20',
                        'transition-all duration-200'
                      )}
                    />
                  </div>

                  {/* Verify Button */}
                  <button
                    onClick={handleVerifyOTP}
                    disabled={isLoading || otpCode.length !== 6}
                    className={cn(
                      'w-full py-3.5 rounded-2xl',
                      'bg-blue-600 hover:bg-blue-500',
                      'text-white font-semibold',
                      'shadow-[0_0_20px_rgba(37,99,235,0.3)]',
                      'hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]',
                      'transition-all duration-200',
                      'active:scale-[0.98]',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'flex items-center justify-center gap-2'
                    )}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify &amp; Enter Vault</span>
                    )}
                  </button>

                  {/* Resend Code */}
                  <p className="text-center text-sm text-white/40 mt-6">
                    Didn&apos;t receive a code?{' '}
                    <button
                      type="button"
                      className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      Resend
                    </button>
                  </p>

                  {/* Security Note */}
                  <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-white/5">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-white/30">
                      Two-Factor Authentication Active
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
