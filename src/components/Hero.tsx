"use client";
import React from 'react';
import useSound from 'use-sound';

interface HeroProps {
  onOpenAuth: () => void;
  onOpenVideo: () => void;
}

export default function Hero({ onOpenAuth, onOpenVideo }: HeroProps) {
  // Sound: Glass slide swoosh for opening video modal
  const [playOpen] = useSound(
    'https://storage.googleapis.com/connexusai-assets/whoosh-high-frequency-smooth-tomas-herudek-1-00-07.mp3',
    { volume: 0.4 }
  );
  return (
    <section className="relative pt-32 pb-32 flex flex-col items-center text-center px-4 overflow-hidden dark:bg-void bg-white transition-colors duration-300">

      {/* --- BACKGROUND LAYERS --- */}

      {/* 1. The "Forgex" Horizon Line (Only visible in Dark Mode) */}
      <div className="absolute top-[60%] left-1/2 -translate-x-1/2 w-[200%] h-[1000px] rounded-[100%] border-t border-blue-500/20 bg-gradient-to-b from-blue-900/10 to-transparent blur-md dark:block hidden pointer-events-none" />

      {/* 2. The Atmospheric Glow (Blue & Gold Mix) */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/10 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />

      {/* 3. Starfield Texture (Subtle Noise) */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 pointer-events-none mix-blend-overlay"></div>


      {/* --- CONTENT --- */}
      <div className="relative z-10 max-w-5xl mx-auto space-y-8 mb-16">

        {/* The Headline */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-slate-900 dark:text-white leading-[1.1]">
          Secure Document Intelligence <br />
          {/* THE METALLIC GOLD GRADIENT TEXT */}
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#FACC15] via-[#EAB308] to-[#CA8A04] drop-shadow-[0_0_20px_rgba(250,204,21,0.4)]">
            in a Sovereign Environment
          </span>
        </h1>

        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          A Digital Fort Knox for your confidential documents.
          AI-powered answers grounded in your data, with verifiable citations.
        </p>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-3 text-[10px] md:text-xs font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          <Badge text="Zero Training" />
          <span className="text-amber-500">•</span>
          <Badge text="SOC2 Ready" />
          <span className="text-amber-500">•</span>
          <Badge text="Private Vaults" />
        </div>
      </div>

      {/* CTAs - Premium Sovereign Styling */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        {/* Primary Button - Electric Blue Gradient with Glow */}
        <button
          onClick={onOpenAuth}
          className="h-14 px-8 rounded-full bg-gradient-to-b from-[#4040FF] to-[#0000FF] hover:from-[#5050FF] hover:to-[#0000DD] text-white font-bold tracking-wide shadow-[0_0_30px_rgba(0,0,255,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(0,0,255,0.7),0_4px_20px_rgba(0,0,255,0.4)] transition-all duration-300 w-full sm:w-auto text-sm hover:-translate-y-0.5"
        >
          Start Free Trial
        </button>

        {/* Secondary Button - Glass Effect */}
        <button
          onClick={() => {
            playOpen();
            onOpenVideo();
          }}
          className="group h-14 px-8 rounded-full border border-slate-300 dark:border-white/20 bg-transparent text-slate-600 dark:text-white hover:border-[#0000FF] hover:text-[#0000FF] dark:hover:border-[#4040FF] dark:hover:text-[#4040FF] font-medium transition-all duration-300 w-full sm:w-auto flex items-center justify-center gap-2 text-sm hover:shadow-[0_0_20px_rgba(0,0,255,0.2)]"
        >
          <svg className="w-4 h-4 text-slate-400 dark:text-white/60 group-hover:text-[#0000FF] dark:group-hover:text-[#4040FF] transition-colors" fill="currentColor" viewBox="0 0 24 24">
             <path d="M8 5v14l11-7z"/>
          </svg>
          See How It Works
        </button>
      </div>
    </section>
  );
}

// --- SUB COMPONENTS ---

function Badge({ text }: { text: string }) {
  return (
    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
      {text}
    </span>
  );
}

