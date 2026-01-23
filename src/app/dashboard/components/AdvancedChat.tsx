"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MODES = [
  { id: 'exec', label: 'Executive Summary', icon: '📊' },
  { id: 'detail', label: 'Deep Dive', icon: '🔍' },
  { id: 'action', label: 'Action Plan', icon: '⚡' },
  { id: 'risk', label: 'Risk Analysis', icon: '⚠️' },
];

export default function AdvancedChat() {
  const [selectedMode, setSelectedMode] = useState('exec');
  const [showLogic, setShowLogic] = useState(false);

  return (
    <div className="flex flex-col h-full relative bg-white dark:bg-[#050505] transition-colors duration-300">

      {/* 1. TOP BAR: MODE SELECTOR (Technical Tabs) */}
      <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] z-20">
        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3 block">
          Response Mode
        </label>
        <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all whitespace-nowrap
                ${selectedMode === mode.id
                  ? 'bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-white/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
                }
              `}
            >
              <span className="text-sm">{mode.icon}</span>
              <span className="hidden sm:inline">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. CHAT STREAM */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">

        {/* USER QUERY */}
        <div className="flex flex-row-reverse gap-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-lg">YO</div>
          <div className="bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 px-5 py-3 rounded-2xl rounded-tr-sm text-sm text-slate-800 dark:text-slate-100 shadow-md max-w-lg">
            What are the primary risks associated with the logistics expansion?
          </div>
        </div>

        {/* AI RESPONSE (The Artifact) */}
        <div className="flex gap-4 group">
          <div className="w-8 h-8 rounded-lg bg-[#0000FF] flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>

          <div className="flex-1 space-y-4">

            {/* META HEADER: Trust Indicators */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-800 dark:text-white">RAGBox Intelligence</span>
              <div className="h-3 w-[1px] bg-slate-300 dark:bg-white/20"></div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                High Confidence (94%)
              </span>
            </div>

            {/* THE CONTENT */}
            <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed space-y-4">
              <p>Based on the <strong className="text-slate-900 dark:text-white">Q3 Financial Report</strong>, there are two primary risks:</p>

              <ul className="space-y-3">
                <li className="bg-slate-50 dark:bg-[#0A0A0A] p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-blue-400 dark:hover:border-blue-500/50 transition-all cursor-pointer shadow-sm hover:shadow-md">
                  <div className="flex justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white">1. Supply Chain Volatility</strong>
                    <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-500/30 font-semibold">Ref 1</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Projected 12% variance in raw material costs due to geopolitical instability.</p>
                </li>

                <li className="bg-slate-50 dark:bg-[#0A0A0A] p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-amber-400 dark:hover:border-amber-500/50 transition-all cursor-pointer shadow-sm hover:shadow-md">
                  <div className="flex justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white">2. Regulatory Compliance (GDPR)</strong>
                    <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/30 font-semibold">Ref 2</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">New EU data residency requirements may delay the Berlin hub opening.</p>
                </li>
              </ul>
            </div>

            {/* 3. EXPLAINABILITY DRAWER */}
            <div className="border-t border-slate-200 dark:border-white/10 pt-3">
              <button
                onClick={() => setShowLogic(!showLogic)}
                className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-white flex items-center gap-2 transition-colors font-bold"
              >
                <svg className={`w-3 h-3 transition-transform ${showLogic ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                Inspect Reasoning Engine
              </button>

              <AnimatePresence>
                {showLogic && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 p-4 bg-slate-100 dark:bg-[#0A0A0A] rounded-xl border border-slate-200 dark:border-white/10 text-[11px] font-mono space-y-2">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Query Expansion:</span>
                        <span className="text-slate-900 dark:text-white font-semibold">"logistics risks" + "supply chain"</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Freshness Check:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Passed (&lt; 30 days)</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Chunks Retrieved:</span>
                        <span className="text-slate-900 dark:text-white font-semibold">4 / 127</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 4. ARTIFACT ACTIONS */}
            <div className="flex gap-2">
              <ActionButton label="Export PDF" icon="down" />
              <ActionButton label="Email Report" icon="mail" />
              <ActionButton label="Copy" icon="copy" />
            </div>

          </div>
        </div>
      </div>

      {/* 5. INPUT AREA (Anchored with Heavy Shadow) */}
      <div className="p-6 pt-4 bg-gradient-to-t from-white via-white to-transparent dark:from-[#050505] dark:via-[#050505] z-10 border-t border-slate-100 dark:border-white/5">
        <div className="relative group">
          {/* Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-2xl opacity-20 group-hover:opacity-40 group-focus-within:opacity-50 transition duration-500 blur-lg"></div>

          <div className="relative flex items-center">
            <input
              type="text"
              placeholder={`Ask about ${selectedMode === 'risk' ? 'risks...' : 'your vault...'}`}
              className="
                  w-full h-14 pl-5 pr-14 rounded-xl
                  bg-white dark:bg-[#0A0A0A]
                  border-2 border-slate-200 dark:border-white/10
                  text-slate-900 dark:text-white
                  placeholder-slate-400 dark:placeholder-slate-500
                  focus:outline-none focus:border-blue-500 dark:focus:border-blue-500
                  transition-all
                  shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]
                  font-medium
              "
            />
            <button className="absolute right-2 h-10 w-10 rounded-lg bg-[#0000FF] hover:bg-blue-600 text-white flex items-center justify-center transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12h14M12 5l7 7-7 7"></path></svg>
            </button>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="text-center mt-4 flex justify-center gap-6 text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-widest">
           <span className="flex items-center gap-1.5">
             <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></span>
             Encrypted
           </span>
           <span className="flex items-center gap-1.5">
             <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]"></span>
             Zero Retention
           </span>
           <span className="flex items-center gap-1.5">
             <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.5)]"></span>
             Sovereign
           </span>
        </div>
      </div>

    </div>
  );
}

function ActionButton({ label, icon }: { label: string, icon: string }) {
    return (
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 hover:border-slate-300 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:hover:border-white/20 text-xs font-medium text-slate-600 dark:text-slate-300 transition-all">
            {icon === 'down' && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>}
            {icon === 'mail' && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
            {icon === 'copy' && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
            {label}
        </button>
    )
}
