// Public landing page — uses CSS custom properties for theme support
"use client";
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SOCIAL_PROOF } from '@/config/stats';
import { AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import Hero from '@/components/Hero';
import FeatureGrid from '@/components/FeatureGrid';
import { AuthModal } from '@/components/AuthModal';
import Footer from '@/components/Footer';
import { TrustBar } from '@/components/landing/TrustBar';

type AuthContext = 'signin' | 'signup' | 'upload';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthCallback: 'Sign-in was interrupted. Please try again.',
  OAuthCreateAccount: 'Could not create your account. Please try again.',
  OAuthAccountNotLinked: 'This email is already linked to a different sign-in method.',
  AccessDenied: 'Access was denied. Please accept the permissions to continue.',
  default: 'Something went wrong during sign-in. Please try again.',
};

function HomeContent() {
  const searchParams = useSearchParams();
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [authContext, setAuthContext] = useState<AuthContext>('signin');
  const [authError, setAuthError] = useState<string | null>(null);

  // Detect OAuth error in URL params — only show if user initiated sign-in
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      // Clean up URL immediately regardless
      window.history.replaceState({}, '', '/');

      // Only show the error if the user actually started an OAuth flow
      const authInitiated = typeof window !== 'undefined' && sessionStorage.getItem('ragbox_auth_initiated');
      if (authInitiated) {
        sessionStorage.removeItem('ragbox_auth_initiated');
        setAuthError(OAUTH_ERROR_MESSAGES[error] || OAUTH_ERROR_MESSAGES.default);
        setAuthOpen(true);
      }
    }
  }, [searchParams]);

  const openAuth = (context: AuthContext) => {
    setAuthContext(context);
    setAuthError(null);
    setAuthOpen(true);
  };

  return (
    <main className="min-h-screen bg-white dark:bg-[#020408] transition-colors duration-300">
      {/* OAuth error banner */}
      {authError && !isAuthOpen && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/90 text-white text-center py-3 px-4 text-sm font-medium">
          {authError}
          <button
            onClick={() => openAuth('signin')}
            className="ml-3 underline hover:no-underline"
          >
            Try Again
          </button>
          <button
            onClick={() => setAuthError(null)}
            className="ml-3 opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}
      <Navbar onOpenAuth={() => openAuth('signin')} />
      <Hero onOpenAuth={() => openAuth('signup')} />
      <FeatureGrid />
      <TrustBar />

      {/* Social Proof */}
      <section className="py-16 bg-white dark:bg-transparent border-t border-[var(--border-subtle)]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-3">
            {SOCIAL_PROOF.vRepsDeployed}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2463EB] to-[#00d4ff]">
              AI agents
            </span>{' '}
            deployed
          </p>
          <p className="text-lg text-[var(--text-tertiary)]">
            across {SOCIAL_PROOF.organizations} organizations — powered by ConnexUS AI
          </p>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-20 bg-white dark:bg-transparent border-t border-[var(--border-subtle)]">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="text-xs uppercase tracking-widest text-[var(--text-tertiary)] mb-4">
            Simple Pricing
          </p>
          <p className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-3">
            Starting at{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#FDE68A] via-[#FBBF24] to-[#D97706]">
              $99/mo
            </span>
          </p>
          <p className="text-base text-[var(--text-tertiary)] mb-8">
            Vault storage, unlimited queries, and full citation audit trails included.
          </p>
          <Link
            href="/pricing"
            className="inline-block px-8 py-3.5 rounded-full bg-gradient-to-b from-[#4040FF] to-[#0000FF] hover:from-[#5050FF] hover:to-[#0000DD] text-white font-bold tracking-wide shadow-[0_0_30px_rgba(0,0,255,0.5)] hover:shadow-[0_0_50px_rgba(0,0,255,0.7)] transition-all duration-300 hover:-translate-y-0.5"
          >
            See Plans
          </Link>
        </div>
      </section>

      <Footer />
      <AnimatePresence>
        {isAuthOpen && (
          <AuthModal
            isOpen={isAuthOpen}
            onClose={() => { setAuthOpen(false); setAuthError(null); }}
            context={authContext}
            errorMessage={authError}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
