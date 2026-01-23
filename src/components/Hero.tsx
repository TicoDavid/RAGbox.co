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
    <section className="relative pt-32 pb-32 flex flex-col items-center text-center px-4 overflow-hidden dark:bg-[#050505] bg-white transition-colors duration-300">

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
          {/* THE GOLD GRADIENT TEXT */}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]">
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

      {/* --- THE HERO ARTIFACT (The Box) --- */}
      <div className="relative z-10 w-full max-w-lg group cursor-pointer perspective-1000">

        {/* 1. THE GOLD PULSE (Replaces Blue) */}
        <div className="
            absolute -inset-1
            bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-600
            rounded-[28px] blur-lg opacity-20
            group-hover:opacity-60
            transition duration-700
            animate-pulse-slow
            pointer-events-none
        " />

        {/* 2. THE GLASS CONTAINER */}
        <div
          onClick={onOpenAuth}
          className="
            relative aspect-square md:aspect-[16/10] rounded-3xl

            /* LIGHT MODE */
            bg-white border border-slate-200 shadow-xl

            /* DARK MODE (Obsidian Glass) */
            dark:bg-[#080808] dark:border-white/10 dark:shadow-2xl dark:shadow-black/50

            flex flex-col items-center justify-center gap-5
            transition-all duration-500
            group-hover:scale-[1.02] group-hover:-translate-y-2
        ">

          {/* Animated Icon Container */}
          <div className="
            p-6 rounded-2xl mb-2 transition-all duration-500
            bg-slate-50 text-slate-400
            dark:bg-white/5 dark:text-amber-400
            group-hover:bg-[#0000FF] group-hover:text-white group-hover:shadow-[0_0_30px_rgba(0,0,255,0.4)]
          ">
             {/* Shield Icon */}
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 2.18L18 8.15V13c0 4.14-2.58 8.16-6 9.39-3.42-1.23-6-5.25-6-9.39V8.15l6-3.97z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-[#0000FF] dark:group-hover:text-white transition-colors">
              Securely Upload for Analysis
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Drag & drop or click to enter vault
            </p>
          </div>

          {/* File Types */}
          <div className="flex gap-2 mt-2">
             <FileChip label="PDF" />
             <FileChip label="DOCX" />
             <FileChip label="TXT" />
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
          <button
            onClick={onOpenAuth}
            className="h-14 px-8 rounded-full bg-[#0000FF] hover:bg-blue-600 text-white font-bold tracking-wide shadow-[0_0_20px_rgba(0,0,255,0.4)] hover:shadow-[0_0_40px_rgba(0,0,255,0.6)] transition-all w-full sm:w-auto text-sm"
          >
            Start Free Trial
          </button>

          <button
            onClick={() => {
              playOpen();
              onOpenVideo();
            }}
            className="group h-14 px-8 rounded-full border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 text-slate-700 dark:text-white hover:bg-white hover:text-[#0000FF] font-medium transition-all w-full sm:w-auto flex items-center justify-center gap-2 text-sm"
          >
            <svg className="w-4 h-4 text-slate-400 group-hover:text-[#0000FF] transition-colors" fill="currentColor" viewBox="0 0 24 24">
               <path d="M8 5v14l11-7z"/>
            </svg>
            See How It Works
          </button>
        </div>
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

function FileChip({ label }: { label: string }) {
  return (
    <span className="
      text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-md
      bg-slate-100 text-slate-500 border border-slate-200
      dark:bg-black dark:text-slate-400 dark:border-white/10
      group-hover:border-blue-200 dark:group-hover:border-blue-500/30 transition-colors
    ">
      {label}
    </span>
  );
}
