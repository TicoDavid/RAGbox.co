"use client";
import React from 'react';

// Define the interface for the props
interface HeroProps {
  onOpenAuth: () => void;
}

export default function Hero({ onOpenAuth }: HeroProps) {
  return (
    <section className="relative pt-32 pb-20 flex flex-col items-center text-center px-4 overflow-hidden dark:bg-[#050505] bg-white transition-colors duration-300">

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

      {/* THE GLASS BOX - No more dashed lines! */}
      <div className="relative z-10 w-full max-w-lg group cursor-pointer">

        {/* The Container with Glass Physics */}
        <div
          onClick={onOpenAuth}
          className="
            relative aspect-square md:aspect-[4/3] rounded-3xl

            /* LIGHT MODE: Clean White Surface */
            bg-white border border-slate-200 shadow-xl shadow-slate-200/50

            /* DARK MODE: Cinematic Glass */
            dark:bg-white/5 dark:border-white/10 dark:shadow-black/50

            /* HOVER EFFECTS: Blue Glow */
            hover:border-[#0000FF]/50 dark:hover:border-[#0000FF]/50
            hover:shadow-[0_0_40px_-10px_rgba(0,0,255,0.15)]
            transition-all duration-500 ease-out

            flex flex-col items-center justify-center gap-4
        ">

          {/* Animated Icon */}
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-white/5 text-[#0000FF] mb-2 group-hover:scale-110 transition-transform duration-300">
             {/* Solid Shield Icon */}
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 2.18L18 8.15V13c0 4.14-2.58 8.16-6 9.39-3.42-1.23-6-5.25-6-9.39V8.15l6-3.97z" />
            </svg>
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Securely Upload for Analysis
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Drag & drop or click to browse
            </p>
          </div>

          {/* Supported Files Chips */}
          <div className="flex gap-3 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            <span className="bg-slate-100 dark:bg-white/10 px-2 py-1 rounded">PDF</span>
            <span className="bg-slate-100 dark:bg-white/10 px-2 py-1 rounded">DOCX</span>
            <span className="bg-slate-100 dark:bg-white/10 px-2 py-1 rounded">TXT</span>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <button
            onClick={onOpenAuth}
            className="h-12 px-8 rounded-full bg-[#0000FF] hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-600/25 transition-all w-full sm:w-auto"
          >
            Start Free Trial
          </button>
          <button className="h-12 px-8 rounded-full border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/10 font-medium transition-all w-full sm:w-auto">
            See How It Works
          </button>
        </div>
      </div>
    </section>
  );
}
