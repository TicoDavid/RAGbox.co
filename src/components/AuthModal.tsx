"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('email');
        setEmail('');
        setIsLoading(false);
      }, 300);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- HANDLERS ---

  // 1. Send Code (Simulated)
  const handleSendCode = () => {
    if (!email) return;
    setIsLoading(true);
    // Fake API delay
    setTimeout(() => {
      setIsLoading(false);
      setStep('otp');
    }, 1500);
  };

  // 2. Verify Code & Redirect
  const handleVerify = () => {
    setIsLoading(true);
    setTimeout(() => {
      router.push('/dashboard');
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">

      {/* 1. CINEMATIC BACKDROP */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-all"
      />

      {/* 2. THE MODAL CARD */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-[400px] overflow-hidden rounded-3xl bg-[#0A0A0A] border border-white/10 shadow-2xl shadow-black"
      >

        {/* Top Highlight (Scanner Effect) */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-50" />

        <div className="p-8 pt-10">

          {/* LOGO & HEADER */}
          <div className="text-center mb-8">
            {/* The White "App Icon" Container */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg shadow-blue-900/10 mb-6">
              {/* Use the BLUE logo for contrast on white */}
              <img
                src="https://storage.googleapis.com/connexusai-assets/BlueLogo_RAGbox.co.png"
                className="w-10 h-auto"
                alt="Logo"
              />
            </div>

            <h2 className="text-2xl font-bold text-white tracking-tight">
              {step === 'email' ? 'Initialize Access' : 'Verify Identity'}
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              {step === 'email'
                ? 'Enter your work email to enter the vault.'
                : <span>Enter the code sent to <span className="text-white font-medium">{email}</span></span>
              }
            </p>
          </div>

          {/* DYNAMIC FORM */}
          <AnimatePresence mode="wait">

            {/* STEP 1: EMAIL (No Password!) */}
            {step === 'email' && (
              <motion.div
                key="step-email"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {/* Email Input */}
                <div className="relative group">
                  <div className="absolute left-4 top-3.5 text-slate-500">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  </div>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>

                {/* Primary Button */}
                <button
                  onClick={handleSendCode}
                  disabled={isLoading || !email}
                  className="w-full h-12 rounded-xl bg-[#0000FF] hover:bg-blue-600 text-white font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"/> : 'Continue Securely'}
                </button>

                {/* SSO SECTION */}
                <div className="relative py-3">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-[#0A0A0A] px-2 text-slate-500">Or</span></div>
                </div>

                {/* Social Buttons (Dark Mode Style) */}
                <div className="grid grid-cols-2 gap-3">
                  <button className="h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-2">
                     <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .533 5.333.533 12S5.867 24 12.48 24c3.44 0 6.04-1.133 8.16-3.293 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.133H12.48z"/></svg>
                     Google
                  </button>
                  <button className="h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-2">
                     <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/></svg>
                     Microsoft
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: OTP (The Vault Key) */}
            {step === 'otp' && (
              <motion.div
                key="step-otp"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* 6 Digit Input */}
                <div className="flex justify-between gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      type="text"
                      maxLength={1}
                      autoFocus={i === 0}
                      className="w-10 h-14 md:w-12 md:h-16 rounded-xl bg-white/5 border border-white/20 text-center text-xl text-white font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
                    />
                  ))}
                </div>

                <button
                  onClick={handleVerify}
                  className="w-full h-12 rounded-xl bg-[#0000FF] hover:bg-blue-600 text-white font-bold transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2"
                >
                  {isLoading ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"/> : 'Verify & Enter Vault'}
                </button>

                <div className="text-center">
                  <button
                    onClick={() => setStep('email')}
                    className="text-xs text-slate-500 hover:text-white transition-colors underline"
                  >
                    Entered wrong email?
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* FOOTER: Security Guarantee */}
        <div className="bg-[#050505] p-4 text-center border-t border-white/5">
          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider">
            <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            Zero Data Exfiltration Guarantee
          </div>
        </div>

      </motion.div>
    </div>
  );
}
