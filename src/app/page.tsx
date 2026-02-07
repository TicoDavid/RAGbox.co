"use client";
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import Hero from '@/components/Hero';
import FeatureGrid from '@/components/FeatureGrid';
import { AuthModal } from '@/components/AuthModal';
import Footer from '@/components/Footer';

type AuthContext = 'signin' | 'signup' | 'upload';

export default function Home() {
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [authContext, setAuthContext] = useState<AuthContext>('signin');

  const openAuth = (context: AuthContext) => {
    setAuthContext(context);
    setAuthOpen(true);
  };

  return (
    <main className="min-h-screen bg-white dark:bg-[#020408] transition-colors duration-300">
      <Navbar onOpenAuth={() => openAuth('signin')} />
      <Hero onOpenAuth={() => openAuth('signup')} />
      <FeatureGrid />
      <Footer />
      <AnimatePresence>
        {isAuthOpen && <AuthModal isOpen={isAuthOpen} onClose={() => setAuthOpen(false)} context={authContext} />}
      </AnimatePresence>
    </main>
  );
}
