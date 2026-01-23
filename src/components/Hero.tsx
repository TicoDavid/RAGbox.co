"use client";
import React from 'react';

// Define the interface for the props
interface HeroProps {
  onOpenAuth: () => void;
  onOpenVideo: () => void;
}

export default function Hero({ onOpenAuth, onOpenVideo }: HeroProps) {
  return (
    <section className="relative pt-32 pb-20 flex flex-col items-center text-center px-4 overflow-hidden dark:bg-[#050505] bg-white transition-colors duration-300">

      {/* MASTER CLASS TEXTURE: The Grid Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Light Mode Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-0" />
        {/* Dark Mode Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px] opacity-0 dark:opacity-100" />
      </div>

      {/* Background Ambience - The "SaaS Glow" */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-500/20 dark:bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* HEADLINES */}
      <div className="relative z-10 max-w-4xl mx-auto space-y-6 mb-12">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white">
          Secure Document Intelligence <br />
          <span className="text-[#0000FF]">in a Sovereign Environment</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          A Digital Fort Knox for your confidential documents.
          AI-powered answers grounded in your data, with verifiable citations.
        </p>

        {/* Trust Badge / Micro Copy */}
        <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-400 dark:text-slate-600 uppercase tracking-widest">
          <span>Zero Training</span>
          <span className="text-blue-500">•</span>
          <span>SOC2 Ready</span>
          <span className="text-blue-500">•</span>
          <span>Private Vaults</span>
        </div>
      </div>

      {/* THE PULSATING GLASS BOX */}
      <div className="relative z-10 w-full max-w-lg group cursor-pointer">

        {/* 1. THE BREATHING GLOW (New)
            - This creates the 'Pulsating' effect behind the box.
            - It is Blue/Cyan in Dark Mode, and Subtle Blue in Light Mode.
        */}
        <div className="
            absolute -inset-0.5
            bg-gradient-to-r from-blue-500 to-cyan-500
            rounded-[26px] blur opacity-20
            group-hover:opacity-75
            transition duration-500
            animate-pulse group-hover:animate-none
        " />

        {/* 2. THE GLASS CONTAINER
            - Added heavier background colors so it doesn't disappear into the grid.
        */}
        <div
          onClick={onOpenAuth}
          className="
            relative aspect-square md:aspect-[4/3] rounded-3xl

            bg-white border border-slate-200

            dark:bg-[#0A0A0A] dark:border-white/10

            flex flex-col items-center justify-center gap-4
            transition-transform duration-500 group-hover:scale-[1.01]
        ">

          {/* Animated Icon Container */}
          <div className="
            p-5 rounded-2xl mb-2 transition-all duration-300
            bg-blue-50 text-[#0000FF]
            dark:bg-white/5 dark:text-blue-400
            group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white
            shadow-lg shadow-blue-500/10 dark:shadow-none
          ">
             {/* Shield Icon */}
            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 2.18L18 8.15V13c0 4.14-2.58 8.16-6 9.39-3.42-1.23-6-5.25-6-9.39V8.15l6-3.97z" />
            </svg>
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Securely Upload for Analysis
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Drag & drop or click to browse
            </p>
          </div>

          {/* Supported Files Chips - Made clearer */}
          <div className="flex gap-2 mt-4">
            {['PDF', 'DOCX', 'TXT'].map((ext) => (
              <span key={ext} className="
                text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md
                bg-slate-100 text-slate-500 border border-slate-200
                dark:bg-white/5 dark:text-slate-400 dark:border-white/5
                group-hover:border-blue-200 dark:group-hover:border-blue-500/30 transition-colors
              ">
                {ext}
              </span>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <button
            onClick={onOpenAuth}
            className="h-12 px-8 rounded-full bg-[#0000FF] hover:bg-blue-700 text-white font-bold tracking-wide shadow-[0_0_20px_rgba(0,0,255,0.3)] hover:shadow-[0_0_30px_rgba(0,0,255,0.5)] transition-all w-full sm:w-auto"
          >
            Start Free Trial
          </button>

          <button
            onClick={onOpenVideo}
            className="group h-12 px-8 rounded-full border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 text-slate-700 dark:text-white hover:bg-white hover:text-blue-600 font-medium transition-all w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" fill="currentColor" viewBox="0 0 24 24">
               <path d="M8 5v14l11-7z"/>
            </svg>
            See How It Works
          </button>
        </div>
      </div>
    </section>
  );
}
