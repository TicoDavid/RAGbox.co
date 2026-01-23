"use client";
import React from 'react';

export default function FeatureGrid() {
  return (
    <section className="py-24 px-6 dark:bg-[#050505] bg-white transition-colors duration-300 relative overflow-hidden">

      {/* Background Decor (Subtle Grid) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">

        {/* SECTION HEADER: High Contrast */}
        <div className="text-center mb-20 space-y-4">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-white">
            Your Files Speak. <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400">
              We Make Them Testify.
            </span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Analyze your vault like a team of experts—without the overhead.
            Reliable. Repeatable. Effortless.
          </p>
        </div>

        {/* THE BENTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

          {/* Card 1: The Silence Protocol */}
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
            }
            title="The Silence Protocol"
            desc="If RAGBox isn't sure, it says so. No guessing. No hallucinating. If the answer isn't in your documents, you'll know instantly."
            tag="ANTI-HALLUCINATION"
          />

          {/* Card 2: The Privilege Switch */}
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            }
            title="The Privilege Switch"
            desc="Flip one switch and privileged documents become invisible to everyone except those who explicitly need to see them."
            tag="ROLE-BASED SECURITY"
          />

          {/* Card 3: Digital Fort Knox */}
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            }
            title="Digital Fort Knox"
            desc="Your documents stay yours. We don't keep copies. We don't train on your data. When you delete it, it's gone forever."
            tag="ZERO-RETENTION"
          />

          {/* Card 4: Unalterable Record */}
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
            }
            title="The Unalterable Record"
            desc="Every query and document access is cryptographically hashed and logged. SEC 17a-4 ready audit trails for total compliance."
            tag="VERITAS PROTOCOL"
          />

        </div>
      </div>
    </section>
  );
}

// --- SUB-COMPONENT: The Premium Card ---
function FeatureCard({ icon, title, desc, tag }: { icon: React.ReactNode, title: string, desc: string, tag: string }) {
  return (
    <div className="
      group relative p-8 md:p-10 rounded-3xl overflow-hidden

      /* LIGHT MODE LOOK */
      bg-white border border-slate-200 shadow-xl shadow-slate-200/40

      /* DARK MODE LOOK */
      dark:bg-[#0A0A0A] dark:border-white/10 dark:shadow-none

      /* HOVER PHYSICS */
      hover:scale-[1.01] hover:shadow-2xl hover:shadow-blue-500/10 dark:hover:border-blue-500/30
      transition-all duration-300 ease-out
    ">

      {/* Background Gradient on Hover (Subtle) */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none dark:from-blue-900/10" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header Row: Icon + Tag */}
        <div className="flex justify-between items-start mb-6">
          <div className="
            w-12 h-12 rounded-2xl flex items-center justify-center
            bg-blue-600 text-white shadow-lg shadow-blue-600/20
            group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300
          ">
            {icon}
          </div>

          <span className="
            px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase
            bg-slate-100 text-slate-600 border border-slate-200
            dark:bg-white/5 dark:text-slate-300 dark:border-white/10
          ">
            {tag}
          </span>
        </div>

        {/* Content */}
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {title}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-base flex-grow">
          {desc}
        </p>
      </div>
    </div>
  )
}
