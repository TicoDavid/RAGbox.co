"use client";
import React from 'react';

export default function FeatureGrid() {
  return (
    <section className="py-24 px-6 relative overflow-hidden transition-colors duration-300 dark:bg-[#050505] bg-white">

      {/* 1. MASTER CLASS TEXTURE: The Grid Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Light Mode Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-0" />
        {/* Dark Mode Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px] opacity-0 dark:opacity-100" />
        {/* Radial Fade (Vignette) */}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent dark:from-[#050505] dark:via-transparent h-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">

        {/* SECTION HEADER */}
        <div className="text-center mb-20 space-y-4">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tighter text-slate-900 dark:text-white">
            Your Files Speak. <br/>
            <span className="text-[#0000FF]">
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
            title="The Silence Protocol"
            desc="If RAGBox isn't sure, it says so. No guessing. If the answer isn't in your documents, you'll know instantly."
            tag="ANTI-HALLUCINATION"
          />

          <FeatureCard
            icon={<SwitchIcon />}
            title="The Privilege Switch"
            desc="Flip one switch and privileged documents become invisible to everyone except those who explicitly need to see them."
            tag="ROLE-BASED SECURITY"
          />

          <FeatureCard
            icon={<LockIcon />}
            title="Digital Fort Knox"
            desc="Your documents stay yours. We don't keep copies. We don't train on your data. When you delete it, it's gone forever."
            tag="ZERO-RETENTION"
          />

          <FeatureCard
            icon={<FileIcon />}
            title="The Unalterable Record"
            desc="Every query and document access is cryptographically hashed and logged. SEC 17a-4 ready audit trails."
            tag="VERITAS PROTOCOL"
          />

        </div>
      </div>
    </section>
  );
}

// --- THE CARD COMPONENT (Fixed Physics) ---
function FeatureCard({ icon, title, desc, tag }: { icon: React.ReactNode, title: string, desc: string, tag: string }) {
  return (
    <div className="
      group relative p-8 md:p-10 rounded-3xl overflow-hidden

      /* LIGHT MODE: Pure White, Soft Border, Expensive Shadow */
      bg-white border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]

      /* DARK MODE: Obsidian Black, Subtle White Border */
      dark:bg-[#0A0A0A] dark:border-white/10 dark:shadow-none

      /* HOVER: Lift up slightly */
      hover:-translate-y-1 transition-all duration-300 ease-out
    ">

      {/* Hover Gradient (Subtle Blue Wash) */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none dark:from-blue-900/10" />

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex justify-between items-start mb-6">
          <div className="
            w-12 h-12 rounded-2xl flex items-center justify-center
            bg-blue-50 text-[#0000FF]
            dark:bg-white/5 dark:text-blue-400
            group-hover:scale-110 transition-transform duration-300
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
const SwitchIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>;
const LockIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>;
const FileIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>;
