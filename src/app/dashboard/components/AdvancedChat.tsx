"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSound from 'use-sound';

const MODES = [
  { id: 'exec', label: 'Executive Summary', icon: '📊', color: 'blue' },
  { id: 'risk', label: 'Risk Analysis', icon: '⚠️', color: 'amber' }, // Gold Theme
  { id: 'action', label: 'Action Plan', icon: '⚡', color: 'emerald' },
];

export default function AdvancedChat() {
  const [selectedMode, setSelectedMode] = useState('exec');
  const [showLogic, setShowLogic] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // Helper to get current theme color
  const currentTheme = MODES.find(m => m.id === selectedMode)?.color || 'blue';

  // Sound: Data stream while AI is thinking
  const [playThinking, { stop: stopThinking }] = useSound(
    'https://storage.googleapis.com/connexusai-assets/digital-data-processing-davies-aguirre-2-2-00-03.mp3',
    { volume: 0.1, loop: true }
  );

  // Sound: Alert ping when analysis is complete
  const [playAlert] = useSound(
    'https://storage.googleapis.com/connexusai-assets/low-battery-alert-notification-jeff-kaale-1-00-01.mp3',
    { volume: 0.3 }
  );

  // Handle sending a query
  const handleAsk = () => {
    setIsThinking(true);
    playThinking();

    // Simulate API delay
    setTimeout(() => {
      stopThinking();
      playAlert();
      setIsThinking(false);
      // TODO: Add actual message logic here
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full relative bg-slate-50 dark:bg-[#050505] transition-colors duration-300">

      {/* 1. TOP BAR: MODE SELECTOR (Glassmorphism) */}
      <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-white/60 dark:bg-[#0A0A0A]/80 backdrop-blur-md z-20 sticky top-0">
        <div className="flex justify-between items-center mb-3">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">
            Response Mode
            </label>
            {/* Live Model Indicator */}
            <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-500 font-mono">ONLINE</span>
            </div>
        </div>

        <div className="flex gap-2">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all
                ${selectedMode === mode.id && mode.color === 'amber'
                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                  : selectedMode === mode.id
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                    : 'bg-white/5 border-white/5 text-slate-500 dark:text-slate-400 hover:bg-white/10'
                }
              `}
            >
              <span>{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. CHAT STREAM */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">

        {/* USER QUERY */}
        <div className="flex flex-row-reverse gap-4">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-white shrink-0">YO</div>
          <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 px-5 py-3 rounded-2xl rounded-tr-sm text-sm text-slate-700 dark:text-slate-200 shadow-sm max-w-lg">
            Analyze the Q3 report for potential supply chain vulnerabilities.
          </div>
        </div>

        {/* AI RESPONSE (The Artifact) */}
        <div className="flex gap-4 group">
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg transition-colors duration-500
            ${selectedMode === 'risk' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-[#0000FF] shadow-blue-500/20'}
          `}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>

          <div className="flex-1 space-y-4">

            {/* META HEADER */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-white">RAGBox Intelligence</span>
              <div className="h-3 w-[1px] bg-slate-300 dark:bg-white/20"></div>
              <span className={`
                text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded border
                ${selectedMode === 'risk'
                    ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                    : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'}
              `}>
                High Confidence (94%)
              </span>
            </div>

            {/* THE CONTENT */}
            <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-4">
              <p>Based on the <strong>Q3 Financial Report</strong>, I have identified <span className="text-amber-500 font-bold">2 critical risks</span>:</p>

              <ul className="space-y-3">
                <li className="bg-white dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/5 hover:border-amber-500/50 transition-colors cursor-pointer shadow-sm group/item">
                  <div className="flex justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white group-hover/item:text-amber-500 transition-colors">1. Supply Chain Volatility</strong>
                    {/* GOLD REF BADGE */}
                    <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 font-mono">Ref 1</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Projected 12% variance in raw material costs due to geopolitical instability.</p>
                </li>

                <li className="bg-white dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/5 hover:border-blue-500/50 transition-colors cursor-pointer shadow-sm group/item">
                  <div className="flex justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white group-hover/item:text-blue-400 transition-colors">2. Regulatory Compliance</strong>
                    {/* BLUE REF BADGE */}
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-mono">Ref 2</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">New EU data residency requirements may delay the Berlin hub opening.</p>
                </li>
              </ul>
            </div>

            {/* EXPLAINABILITY DRAWER */}
            <div className="border-t border-slate-200 dark:border-white/10 pt-3">
              <button
                onClick={() => setShowLogic(!showLogic)}
                className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-white flex items-center gap-2 transition-colors font-semibold"
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
                    <div className="mt-3 p-3 bg-slate-100 dark:bg-[#0A0A0A] rounded-lg border border-slate-200 dark:border-white/10 text-[10px] font-mono space-y-2">
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Chunks Retrieved:</span>
                        <span className="text-slate-900 dark:text-white">14 (Top-K: 5)</span>
                      </div>
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Sovereignty Check:</span>
                        <span className="text-amber-500">Vault Locked (No Egress)</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ARTIFACT ACTIONS */}
            <div className="flex gap-2">
              <ActionButton label="Export PDF" icon="down" />
              <ActionButton label="Email Report" icon="mail" />
            </div>

          </div>
        </div>
      </div>

      {/* 5. INPUT AREA */}
      <div className="p-6 pt-2 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent dark:from-[#050505] dark:via-[#050505] z-10">
        <div className="relative group">
            {/* The Gradient Glow varies by mode */}
          <div className={`absolute -inset-0.5 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur ${selectedMode === 'risk' ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-gradient-to-r from-blue-500 to-purple-500'}`}></div>

          <input
            type="text"
            placeholder={`Ask about ${selectedMode === 'risk' ? 'risks...' : 'your vault...'}`}
            className="
                relative w-full h-14 pl-5 pr-12 rounded-xl
                bg-white dark:bg-[#0A0A0A]
                border border-slate-200 dark:border-white/10
                text-slate-900 dark:text-white
                placeholder-slate-400
                focus:outline-none focus:border-white/20
                transition-all shadow-xl shadow-slate-200/50 dark:shadow-black/50
            "
          />
          <button
            onClick={handleAsk}
            disabled={isThinking}
            className={`absolute right-2 top-2 h-10 w-10 rounded-lg text-white flex items-center justify-center transition-colors shadow-lg disabled:opacity-50 ${selectedMode === 'risk' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-[#0000FF] hover:bg-blue-600'}`}
          >
            {isThinking ? (
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7"></path></svg>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}

function ActionButton({ label, icon }: { label: string, icon: string }) {
    return (
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 text-xs text-slate-500 dark:text-slate-300 transition-colors shadow-sm">
            {icon === 'down' && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>}
            {icon === 'mail' && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
            {label}
        </button>
    )
}
