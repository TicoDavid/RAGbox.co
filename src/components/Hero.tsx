"use client";
import React, { useState, useRef, useEffect } from 'react';
import useSound from 'use-sound';

interface HeroProps {
  onOpenAuth: () => void;
}

export default function Hero({ onOpenAuth }: HeroProps) {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const demoVideoRef = useRef<HTMLVideoElement>(null);

  // Sound: Glass slide swoosh for playing video
  const [playOpen] = useSound(
    'https://storage.googleapis.com/connexusai-assets/whoosh-high-frequency-smooth-tomas-herudek-1-00-07.mp3',
    { volume: 0.4 }
  );

  const handleVideoToggle = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      } else {
        playOpen();
        videoRef.current.play();
        setIsVideoPlaying(true);
      }
    }
  };

  const handleVideoEnded = () => {
    setIsVideoPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const openDemoModal = () => {
    playOpen();
    setIsDemoModalOpen(true);
  };

  const closeDemoModal = () => {
    setIsDemoModalOpen(false);
    if (demoVideoRef.current) {
      demoVideoRef.current.pause();
      demoVideoRef.current.currentTime = 0;
    }
  };

  const handleDemoVideoEnded = () => {
    closeDemoModal();
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDemoModal();
    };
    if (isDemoModalOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isDemoModalOpen]);
  return (
    <section className="relative pt-24 sm:pt-28 md:pt-32 lg:pt-36 pb-4 flex flex-col items-center text-center px-4 overflow-hidden dark:bg-[#050505] bg-white transition-colors duration-300">

      {/* --- BACKGROUND LAYERS --- */}

      {/* 1. The "Forgex" Horizon Line (Only visible in Dark Mode) */}
      <div className="absolute top-[60%] left-1/2 -translate-x-1/2 w-[200%] h-[1000px] rounded-[100%] border-t border-blue-500/20 bg-gradient-to-b from-blue-900/10 to-transparent blur-md dark:block hidden pointer-events-none" />

      {/* 2. The Atmospheric Glow (Blue & Gold Mix) */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/10 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />

      {/* 3. Starfield Texture (Subtle Noise) */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 pointer-events-none mix-blend-overlay"></div>


      {/* --- CONTENT --- */}
      <div className="relative z-10 max-w-5xl mx-auto space-y-4 mb-8">

        {/* The Headline */}
        <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-slate-900 dark:text-white leading-[1.1]">
          <span className="sm:whitespace-nowrap">Your Private AI. Grounded in Truth.</span> <br />
          {/* THE METALLIC GOLD GRADIENT TEXT */}
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#FACC15] via-[#EAB308] to-[#CA8A04] drop-shadow-[0_0_20px_rgba(250,204,21,0.4)]">
            Locked in a Vault.
          </span>
        </h1>

        <p className="text-sm sm:text-base md:text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-5xl mx-auto leading-relaxed px-2">
          A Digital Fort Knox for your intellectual property. Chat with your most confidential documents without fear of data leaks or AI hallucinations. Every answer is cited, verifiable, and yours alone.
        </p>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[8px] sm:text-[10px] md:text-xs font-mono text-[#cccccc] uppercase tracking-widest">
          <Badge text="Instant Utility" />
          <span className="text-amber-500 hidden sm:inline">•</span>
          <Badge text="Enterprise-Grade Shielding" />
          <span className="text-amber-500 hidden sm:inline">•</span>
          <Badge text="Total Sovereignty" />
        </div>
      </div>

      {/* --- THE HERO ARTIFACT (Video + Logo) --- */}
      <div className="relative z-10 w-full max-w-[200px] md:max-w-[280px] lg:max-w-[320px] group perspective-1000">

        {/* Yellow Glow Effect - Behind the shield */}
        <div
          className={`
            absolute inset-0 bg-yellow-400/40 blur-[80px] rounded-full pointer-events-none -z-10
            transition-all duration-300
            group-hover:bg-yellow-400/60 group-hover:scale-110
            ${isVideoPlaying ? 'animate-pulse-intense bg-yellow-400/70 scale-125' : 'animate-pulse'}
          `}
        />

        {/* Shield Logo with Background Video - 3:4 Aspect Ratio */}
        <div
          onClick={handleVideoToggle}
          className="relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer group/logo"
        >
          {/* Video */}
          <video
            ref={videoRef}
            src="https://storage.googleapis.com/connexusai-assets/ICON_Video_RAGb%C3%B6x.mp4"
            onEnded={handleVideoEnded}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover rounded-2xl shadow-[0_0_40px_rgba(250,204,21,0.4)]"
          />

          {/* Play/Pause Icon Overlay */}
          <div className={`
            absolute inset-0 flex items-center justify-center
            transition-opacity duration-300
            ${isVideoPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-0 group-hover/logo:opacity-100'}
          `}>
            <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20">
              {isVideoPlaying ? (
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* CTAs - Premium Sovereign Styling */}
        <div className="flex flex-col items-center justify-center gap-2 mt-6">
          {/* Primary Button - Electric Blue Gradient with Glow */}
          <button
            onClick={onOpenAuth}
            className="h-12 sm:h-14 px-6 sm:px-8 rounded-full bg-gradient-to-b from-[#4040FF] to-[#0000FF] hover:from-[#5050FF] hover:to-[#0000DD] text-white font-bold tracking-wide shadow-[0_0_30px_rgba(0,0,255,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(0,0,255,0.7),0_4px_20px_rgba(0,0,255,0.4)] transition-all duration-300 w-full sm:w-auto text-sm sm:text-base hover:-translate-y-0.5"
          >
            Secure Your First Vault
          </button>
          {/* Secondary Action Link */}
          <button
            onClick={openDemoModal}
            className="text-base mt-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            or watch the 2-minute demo
          </button>
        </div>
      </div>

      {/* Demo Video Modal */}
      {isDemoModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-xl cursor-pointer"
            onClick={closeDemoModal}
          />
          {/* Video Container */}
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            {/* Close Button */}
            <button
              onClick={closeDemoModal}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white transition-all border border-white/10"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* Video Player */}
            <video
              ref={demoVideoRef}
              src="https://storage.googleapis.com/connexusai-assets/RAGbox.co.mp4"
              autoPlay
              controls
              playsInline
              onEnded={handleDemoVideoEnded}
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}
    </section>
  );
}

// --- SUB COMPONENTS ---

function Badge({ text }: { text: string }) {
  return (
    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/20 text-[#cccccc]">
      {text}
    </span>
  );
}

