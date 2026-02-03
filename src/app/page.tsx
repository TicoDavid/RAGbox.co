"use client";
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import Hero from '@/components/Hero';
import FeatureGrid from '@/components/FeatureGrid';
import { AuthModal } from '@/components/AuthModal';
import VideoModal from '@/components/VideoModal';
import Footer from '@/components/Footer';

type AuthContext = 'signin' | 'signup' | 'upload';

export default function Home() {
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [authContext, setAuthContext] = useState<AuthContext>('signin');
  const [isVideoOpen, setVideoOpen] = useState(false);

  const openAuth = (context: AuthContext) => {
    setAuthContext(context);
    setAuthOpen(true);
  };

  return (
    <main className="min-h-screen dark:bg-void bg-white transition-colors duration-300">
      <Navbar onOpenAuth={() => openAuth('signin')} />
      <Hero onOpenAuth={() => openAuth('signup')} onOpenVideo={() => setVideoOpen(true)} />
      <FeatureGrid />
      <Footer />
      <AnimatePresence>
        {isAuthOpen && <AuthModal isOpen={isAuthOpen} onClose={() => setAuthOpen(false)} context={authContext} />}
      </AnimatePresence>

      <AnimatePresence>
        {isVideoOpen && (
          <VideoModal
            isOpen={isVideoOpen}
            onClose={() => setVideoOpen(false)}
            videoUrl="https://storage.googleapis.com/connexusai-assets/Product%20Release%202026%20Video.mp4"
          />
        )}
      </AnimatePresence>
    </main>
  );
}
