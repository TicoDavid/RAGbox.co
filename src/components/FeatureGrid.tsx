// THEME-EXEMPT: Public landing page, locked to Cobalt palette
"use client";
import React from 'react';

export default function FeatureGrid() {
  return (
    <section className="pt-8 pb-24 px-6 relative overflow-hidden transition-colors duration-300 bg-white dark:bg-transparent">

      {/* 1. MASTER CLASS TEXTURE: The Grid Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Light Mode Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-0" />
        {/* Dark Mode Grid - Obsidian with faint lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:48px_48px] opacity-0 dark:opacity-100" />
        {/* The Horizon Glow Reflection (Gold Dust - Dark Mode Only) */}
        <div className="absolute top-0 left-0 right-0 h-[600px] bg-gradient-to-b from-amber-500/8 via-amber-900/3 to-transparent hidden dark:block" />
        {/* Radial Fade (Vignette) */}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent dark:from-[#020408] dark:via-transparent h-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">

        {/* SECTION HEADER */}
        <div className="text-center mb-20 space-y-4">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tighter text-slate-900 dark:text-white">
            Your Files Speak. <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2463EB] via-[#00a8ff] to-[#00d4ff] drop-shadow-[0_0_25px_rgba(0,168,255,0.5)]">
              We Make Them Testify.
            </span>
          </h2>
          <p className="text-lg font-medium text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Analyze your vault like a team of experts—without the overhead.
            Reliable. Repeatable. Effortless.
          </p>
        </div>

        {/* THE BENTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

          <FeatureCard
            icon={<ShieldIcon />}
            title="Sovereign Knowledge"
            desc="AES-256-GCM encrypted vault with zero-retention architecture. Your documents stay yours — we never train on your data."
            tag="Vault + Encryption"
          />

          <FeatureCard
            icon={<PersonaIcon />}
            title="10 AI Personas"
            desc="From CEO strategic briefs to Whistleblower evidence logs — choose the lens that fits your analysis. Each persona sees your documents differently."
            tag="CEO to Whistleblower"
          />

          <FeatureCard
            icon={<FileIcon />}
            title="Sovereign Studio"
            desc="Generate compliance reports, executive decks, evidence timelines, and research briefs — all grounded in your actual documents with verifiable citations."
            tag="Reports + Decks"
          />

          <FeatureCard
            icon={<MicIcon />}
            title="Mercury Assistant"
            desc="Talk, type, or email your questions. Mercury works across every channel — voice, chat, WhatsApp, SMS — so your knowledge base is always one message away."
            tag="Voice + Chat + Email"
          />

        </div>
      </div>
    </section>
  );
}

// --- THE CARD COMPONENT (Obsidian Glass + Gold Rims) ---
function FeatureCard({ icon, title, desc, tag }: { icon: React.ReactNode, title: string, desc: string, tag: string }) {
  return (
    <div className="
      group relative p-8 md:p-10 rounded-3xl overflow-hidden
      bg-white border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]
      dark:bg-gray-900/80 dark:backdrop-blur-xl dark:border dark:border-white/5 dark:border-t-white/10 dark:shadow-none
      hover:-translate-y-1 transition-all duration-300 ease-out
      dark:hover:border-amber-500/40 dark:hover:shadow-[inset_0_0_40px_-10px_rgba(245,158,11,0.15),0_0_40px_-10px_rgba(245,158,11,0.2)]
    ">

      {/* Hover Gradient (Golden Wash) */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none dark:from-amber-500/5 dark:via-amber-900/5 dark:to-transparent" />

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex justify-between items-start mb-6">
          <div className="
            w-12 h-12 rounded-2xl flex items-center justify-center
            bg-blue-50 text-[#0000FF]
            dark:bg-white/5 dark:text-blue-400
            group-hover:scale-110 transition-all duration-300
            dark:group-hover:text-amber-400 dark:group-hover:bg-amber-500/10
          ">
            {icon}
          </div>

          <span className="
            px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase
            bg-slate-100 text-slate-600 border border-slate-200
            dark:bg-white/5 dark:text-slate-400 dark:border-white/10
          ">
            {tag}
          </span>
        </div>

        <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-3 group-hover:text-[#0000FF] dark:group-hover:text-blue-400 transition-colors">
          {title}
        </h3>
        <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-base">
          {desc}
        </p>
      </div>
    </div>
  )
}

// --- ICONS (Clean SVGs) ---
const ShieldIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>;
const PersonaIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>;
const FileIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>;
const MicIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z"></path></svg>;
