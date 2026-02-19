"use client";
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
