"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import useSound from 'use-sound';
import AdvancedChat from './components/AdvancedChat';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Home');

  // Sound: Tactile hover click for sidebar
  const [playHover] = useSound(
    'https://storage.googleapis.com/connexusai-assets/sci-fi-whoosh-ui-click-brukowskij-1-00-02.mp3',
    { volume: 0.2 }
  );

  return (
    <div className="flex h-screen bg-[#F8F9FA] dark:bg-[#050505] text-slate-900 dark:text-white overflow-hidden font-sans selection:bg-blue-500/30 transition-colors duration-300">

      {/* 1. MASTER BACKGROUND GRID (The "Technical" Texture) */}
      <div className="absolute inset-0 pointer-events-none z-0">
         <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      {/* 2. SIDEBAR RAIL (High Contrast Anchor) */}
      <aside className="w-[72px] flex flex-col items-center py-6 gap-6 bg-[#0F172A] z-30 shadow-2xl">
        {/* LOGO: Use the 'App Icon' version */}
        <div className="w-10 h-10 rounded-xl bg-[#0000FF] flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30 mb-4 cursor-pointer hover:scale-105 transition-transform">
           {/* Use your icon image here, or this SVG placeholder */}
           <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
        </div>

        {/* NAV ITEMS */}
        {['Home', 'Vault', 'Settings'].map((item) => (
            <button
              key={item}
              onMouseEnter={() => playHover()}
              onClick={() => setActiveTab(item)}
              className={`p-3 rounded-xl transition-all duration-300 group relative ${
                activeTab === item
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <NavItemIcon name={item} />
              {/* Tooltip */}
              <span className="absolute left-14 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {item}
              </span>
            </button>
        ))}

        <div className="flex-1" />

        {/* User Profile */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 ring-2 ring-[#0F172A] cursor-pointer" />
      </aside>

      {/* 3. MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col relative z-10">

        {/* GLASS HEADER */}
        <header className="h-16 border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-6 bg-white/60 dark:bg-[#050505]/60 backdrop-blur-xl z-20">

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Vault</span>
            <svg className="w-4 h-4 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18l6-6-6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /></svg>
                <span className="text-slate-700 dark:text-white font-semibold truncate max-w-[200px]">Q3_Performance_Analysis.pdf</span>
            </div>
          </div>

          {/* STATUS BADGE - NOW IN GOLD */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20">
             <div className="relative flex h-2 w-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
             </div>
             <span className="text-[10px] font-bold text-amber-700 dark:text-amber-500 tracking-widest uppercase">
               Sovereign Environment
             </span>
          </div>
        </header>

        {/* SPLIT VIEW */}
        <div className="flex-1 flex overflow-hidden">

            {/* LEFT: DOCUMENT VIEWER */}
            <div className="w-1/2 bg-[#F1F3F5] dark:bg-[#0A0A0A] border-r border-slate-200 dark:border-white/10 flex flex-col relative">

                {/* PDF Toolbar */}
                <div className="h-12 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#111] flex items-center justify-between px-4 text-slate-500">
                    <div className="flex gap-2">
                        <ToolBtn icon="zoom-out" />
                        <span className="text-xs font-mono self-center px-2">100%</span>
                        <ToolBtn icon="zoom-in" />
                    </div>
                    <div className="text-xs font-medium">Page 1 of 14</div>
                    <div className="flex gap-2">
                        <ToolBtn icon="download" />
                        <ToolBtn icon="search" />
                    </div>
                </div>

                {/* The Document Canvas */}
                <div className="flex-1 overflow-y-auto p-8 flex justify-center">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="
                            w-full max-w-[600px] min-h-[800px]
                            bg-white text-black
                            shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)]
                            border border-slate-200
                            rounded-sm relative
                            p-12
                        "
                    >
                         {/* Content Simulation */}
                        <h1 className="text-3xl font-bold mb-6 font-serif">Q3 Performance Analysis</h1>
                        <div className="space-y-4 font-serif text-gray-800 text-[15px] leading-relaxed">
                            <p><strong>Executive Summary:</strong> The third quarter demonstrated resilience in core logistics sectors despite geopolitical headwinds.</p>
                            <p>Revenue increased by <span className="bg-yellow-100">14% year-over-year</span>, driven primarily by the automation initiative.</p>

                            {/* Fake Chart */}
                            <div className="mt-8 p-4 border border-slate-100 bg-slate-50 rounded-lg">
                                <div className="h-32 flex items-end gap-2 px-4 pb-2 border-b border-slate-200">
                                    <div className="w-8 bg-blue-200 h-[40%]" />
                                    <div className="w-8 bg-blue-300 h-[60%]" />
                                    <div className="w-8 bg-blue-400 h-[50%]" />
                                    <div className="w-8 bg-[#0000FF] h-[85%]" />
                                </div>
                                <div className="text-center text-[10px] text-slate-400 mt-2 uppercase tracking-widest">Figure 1.A: Growth Velocity</div>
                            </div>

                            <p>Detailed breakdown of risk factors follows in Section 4...</p>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* RIGHT: CHAT INTELLIGENCE */}
            <div className="w-1/2 flex flex-col bg-white dark:bg-[#050505]">
                <AdvancedChat />
            </div>

        </div>
      </main>
    </div>
  );
}

// --- SUB COMPONENTS ---
function NavItemIcon({ name }: { name: string }) {
    if (name === 'Home') return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
    if (name === 'Vault') return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>
    return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
}

function ToolBtn({ icon }: { icon: string }) {
    return <button className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"><div className="w-4 h-4 bg-current opacity-50" /></button>
}
