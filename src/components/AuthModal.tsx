// THEME-EXEMPT: Auth modal — dark obsidian gold to match landing V3.1
"use client";
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { KeyRound } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: 'signin' | 'signup' | 'upload';
  errorMessage?: string | null;
}

const HEADERS = {
  signin: { title: 'Welcome Back', subtitle: 'Sign in to access your vault.' },
  signup: { title: 'Create Sovereign Vault', subtitle: 'Enter your work email to get started.' },
  upload: { title: 'Authenticate to Analyze', subtitle: 'Sign in to upload and interrogate your documents.' },
};

export function AuthModal({ isOpen, onClose, context = 'signin', errorMessage }: AuthModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState(''); // For dev mode display
  const [betaCode, setBetaCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [isReturningUser, setIsReturningUser] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check if this is a returning user (previously authenticated on this browser)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('ragbox_user_verified')) {
        setIsReturningUser(true);
      }
    } catch { /* private browsing */ }
  }, []);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('email');
        setEmail('');
        setOtp(['', '', '', '', '', '']);
        setIsLoading(false);
        setError('');
        setDevOtp('');
        setBetaCode('');
        setCodeError('');
      }, 300);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- HANDLERS ---

  // 1. Send OTP via API
  const handleSendCode = async () => {
    if (!email) return;
    setIsLoading(true);
    setError('');

    try {
      const res = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send code');
      }

      // In dev mode, show OTP for testing
      if (data.otp) {
        setDevOtp(data.otp);
      }

      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // Submit on Enter if all digits are filled
    if (e.key === 'Enter') {
      e.preventDefault();
      const otpCode = otp.join('');
      if (otpCode.length === 6 && !isLoading) {
        handleVerify();
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // 3. Verify OTP & Sign In
  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('email-otp', {
        email,
        otp: otpCode,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid or expired code. Please try again.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        // Success - redirect to dashboard
        setTimeout(() => {
          router.push('/dashboard');
          onClose();
        }, 1500); // Give sound time to play
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Beta code helpers
  const storeBetaCode = () => {
    if (typeof window !== 'undefined' && betaCode.trim()) {
      sessionStorage.setItem('ragbox_beta_code', betaCode.trim().toUpperCase());
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBetaCode(e.target.value.toUpperCase());
    if (codeError) setCodeError('');
  };

  // 5. Google Sign In
  const handleGoogleSignIn = () => {
    if (!isReturningUser && !betaCode.trim()) {
      setCodeError('Please enter your access code');
      return;
    }
    setCodeError('');
    if (betaCode.trim()) storeBetaCode();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ragbox_auth_initiated', '1');
    }
    signIn('google', { callbackUrl: '/dashboard' });
  };

  // 6. Microsoft Sign In (Azure AD)
  const handleMicrosoftSignIn = () => {
    if (!isReturningUser && !betaCode.trim()) {
      setCodeError('Please enter your access code');
      return;
    }
    setCodeError('');
    if (betaCode.trim()) storeBetaCode();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ragbox_auth_initiated', '1');
    }
    signIn('azure-ad', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">

      {/* 1. CINEMATIC BACKDROP */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-all"
      />

      {/* 2. THE MODAL CARD — Dark obsidian */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-[400px] overflow-hidden rounded-2xl bg-[#112240] border border-white/[0.06] shadow-2xl shadow-black/50"
      >

        {/* Top Highlight (Gold Scanner) */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-70" />

        <div className="p-8 pt-10">

          {/* LOGO & HEADER */}
          <div className="text-center mb-8">
            {/* Flat wordmark */}
            <p className="text-2xl font-bold tracking-tight mb-6">
              <span className="text-white">RAG</span>
              <span className="text-amber-500">böx</span>
              <span className="text-[#8892B0] text-lg font-normal">.co</span>
            </p>

            <h2 className="text-2xl font-bold text-white tracking-tight">
              {step === 'email' ? HEADERS[context].title : 'Verify Identity'}
            </h2>
            <p className="text-sm text-[#8892B0] mt-2">
              {step === 'email'
                ? HEADERS[context].subtitle
                : <span>Enter the code sent to <span className="text-white font-medium">{email}</span></span>
              }
            </p>
          </div>

          {/* Beta Access Code — hidden for returning users */}
          {step === 'email' && !isReturningUser && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-[#8892B0] uppercase tracking-wide">Enter Your Access Code</span>
              </div>
              <input
                type="text"
                value={betaCode}
                onChange={handleCodeChange}
                placeholder="RBX-LEGAL-XXXXXX"
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white text-sm font-mono tracking-widest text-center placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all ${
                  codeError ? 'border-red-400' : 'border-white/10 hover:border-white/20'
                }`}
                autoComplete="off"
                spellCheck={false}
              />
              {codeError && (
                <p className="text-xs text-red-400 mt-1.5 text-center">{codeError}</p>
              )}
              <p className="text-[10px] text-[#8892B0] mt-1.5 text-center">
                Don&apos;t have a code?{' '}
                <a
                  href="https://ragbox.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-500 hover:text-amber-400 underline underline-offset-2 transition-colors"
                >
                  Apply at ragbox.co
                </a>
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
            >
              {error}
            </motion.div>
          )}

          {/* Dev Mode OTP Display — only in development */}
          {process.env.NODE_ENV === 'development' && devOtp && step === 'otp' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm text-center font-mono"
            >
              Dev Mode OTP: <span className="font-bold">{devOtp}</span>
            </motion.div>
          )}

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
                  <div className="absolute left-4 top-3.5 text-[#8892B0]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  </div>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                    className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                </div>

                {/* Primary Button — amber/gold */}
                <button
                  onClick={handleSendCode}
                  disabled={isLoading || !email}
                  className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-all shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <span className="animate-spin w-5 h-5 border-2 border-black/30 border-t-black rounded-full"/> : 'Continue Securely'}
                </button>

                {/* SSO SECTION */}
                <div className="relative py-3">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-[#112240] px-2 text-[#8892B0]">Or</span></div>
                </div>

                {/* OAuth Error Message */}
                {errorMessage && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                    {errorMessage}
                  </div>
                )}

                {/* Social Buttons — outline style */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleGoogleSignIn}
                    className="h-10 rounded-lg bg-transparent hover:bg-white/5 border border-white/10 hover:border-white/20 text-[#8892B0] hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-2"
                  >
                     <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .533 5.333.533 12S5.867 24 12.48 24c3.44 0 6.04-1.133 8.16-3.293 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.133H12.48z"/></svg>
                     Google
                  </button>
                  <button
                    onClick={handleMicrosoftSignIn}
                    className="h-10 rounded-lg bg-transparent hover:bg-white/5 border border-white/10 hover:border-white/20 text-[#8892B0] hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-2"
                  >
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
                <div className="flex justify-between gap-2" onPaste={handleOtpPaste}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      autoFocus={i === 0}
                      value={otp[i]}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-10 h-14 md:w-12 md:h-16 rounded-xl bg-white/5 border border-white/10 text-center text-xl text-white font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
                    />
                  ))}
                </div>

                <button
                  onClick={handleVerify}
                  disabled={isLoading || otp.join('').length !== 6}
                  className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-all shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <span className="animate-spin w-5 h-5 border-2 border-black/30 border-t-black rounded-full"/> : 'Verify & Enter Vault'}
                </button>

                <div className="text-center">
                  <button
                    onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']); setError(''); }}
                    className="text-xs text-[#8892B0] hover:text-white transition-colors underline"
                  >
                    Entered wrong email?
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* FOOTER: Security Guarantee */}
        <div className="bg-white/[0.02] p-4 text-center border-t border-white/[0.06]">
          <div className="flex items-center justify-center gap-2 text-[11px] text-[#8892B0] uppercase tracking-wider font-medium">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            Zero Data Exfiltration Guarantee
          </div>
        </div>

      </motion.div>
    </div>
  );
}
