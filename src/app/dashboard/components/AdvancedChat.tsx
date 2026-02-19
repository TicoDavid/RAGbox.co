"use client";
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- MOCK RAG RESPONSES ---
const MOCK_ANSWERS = {
  default: "I've analyzed the document. Based on the sovereign index, I found 3 key data points regarding this query.",
  risk: "CRITICAL FINDING: The Q3 report indicates a 12% dependency variance in the APAC supply chain. This exceeds the risk threshold defined in your Governance Policy.",
  summary: "Executive Summary: Q3 demonstrated resilience. Revenue is up 14% YoY ($1.2M), primarily driven by the automation initiative. OpEx reduced by 4%.",
};

export default function AdvancedChat() {
  const [messages, setMessages] = useState<Array<{role: 'user' | 'ai', content: string, mode?: string}>>([
    { role: 'ai', content: "Vault Secure. I am ready to interrogate the Q3 Performance Analysis. What do you need to know?", mode: 'default' }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedMode, setSelectedMode] = useState('exec');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // 1. Add User Message
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsThinking(true);

    // 2. Simulate RAG Latency (Thinking)
    setTimeout(() => {
      setIsThinking(false);

      // 3. Determine Response based on Mode
      let responseText = MOCK_ANSWERS.default;
      if (selectedMode === 'risk' || userMsg.toLowerCase().includes('risk')) responseText = MOCK_ANSWERS.risk;
      if (selectedMode === 'exec' || userMsg.toLowerCase().includes('summary')) responseText = MOCK_ANSWERS.summary;

      setMessages(prev => [...prev, { role: 'ai', content: responseText, mode: selectedMode }]);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="flex flex-col h-full relative bg-slate-50 dark:bg-[var(--bg-primary)] transition-colors duration-300">

      {/* 1. TOP BAR: MODE SELECTOR */}
      <div className="p-4 border-b border-slate-200 dark:border-[var(--border-default)] bg-white/80 dark:bg-[var(--bg-primary)]/80 backdrop-blur-md z-20 sticky top-0">
        <div className="flex justify-between items-center mb-3">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block">Response Mode</label>
            <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                <span className="text-[10px] text-[var(--success)] font-mono">ONLINE</span>
            </div>
        </div>
        <div className="flex gap-2">
          {[
            { id: 'exec', label: 'Executive Summary', icon: '📊' },
            { id: 'risk', label: 'Risk Analysis', icon: '⚠️' },
            { id: 'action', label: 'Action Plan', icon: '⚡' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all
                ${selectedMode === mode.id
                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-500/50 dark:text-blue-400'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-blue-400 dark:bg-white/5 dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-white/10'}
              `}
            >
              <span>{mode.icon}</span>{mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. CHAT STREAM */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>

            {/* AVATAR */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm text-xs font-bold
              ${msg.role === 'user'
                ? 'bg-slate-200 text-slate-600 dark:bg-[var(--bg-secondary)] dark:text-[var(--text-primary)]'
                : 'bg-[var(--brand-blue)] text-[var(--text-primary)] shadow-blue-500/20'}
            `}>
              {msg.role === 'user' ? 'YO' : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            </div>

            {/* BUBBLE */}
            <div className={`
              px-5 py-3 rounded-2xl text-sm shadow-sm max-w-[85%] leading-relaxed
              ${msg.role === 'user'
                ? 'bg-white dark:bg-[var(--bg-secondary)] border border-slate-200 dark:border-[var(--border-default)] text-slate-700 dark:text-[var(--text-secondary)] rounded-tr-sm'
                : 'bg-transparent text-slate-600 dark:text-[var(--text-secondary)] pl-0 pt-1'}
            `}>
              {msg.content}

              {/* If AI, show artifacts */}
              {msg.role === 'ai' && idx > 0 && (
                 <div className="mt-4 space-y-3">
                    <div className="bg-white dark:bg-white/5 p-3 rounded-lg border border-slate-200 dark:border-[var(--border-subtle)] hover:border-blue-400 transition-colors cursor-pointer group">
                        <div className="flex justify-between mb-1">
                            <strong className="text-xs text-slate-900 dark:text-[var(--text-primary)] group-hover:text-blue-500">1. Supply Chain Volatility</strong>
                            <span className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 rounded border border-blue-100 dark:border-blue-500/30">Ref 1</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-[var(--text-secondary)]">Projected 12% variance in raw material costs.</p>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <button className="text-[10px] flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-[var(--border-subtle)] hover:bg-white dark:hover:bg-white/10 transition-colors">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Export
                        </button>
                    </div>
                 </div>
              )}
            </div>
          </div>
        ))}

        {/* THINKING STATE */}
        {isThinking && (
          <div className="flex gap-4">
             <div className="w-8 h-8 rounded-lg bg-[var(--brand-blue)] flex items-center justify-center shrink-0 animate-pulse">
                <svg className="w-4 h-4 text-[var(--text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
             <div className="flex items-center gap-1 h-8">
                <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
             </div>
          </div>
        )}
      </div>

      {/* 3. INPUT AREA */}
      <div className="p-6 pt-2 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent dark:from-[var(--bg-primary)] dark:via-[var(--bg-primary)] z-10">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your vault..."
            className="relative w-full h-14 pl-5 pr-12 rounded-xl bg-white dark:bg-[var(--bg-primary)] border border-slate-200 dark:border-[var(--border-default)] text-slate-900 dark:text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:border-blue-500/50 transition-all shadow-xl"
          />
          <button
            onClick={handleSend}
            disabled={isThinking}
            className="absolute right-2 top-2 h-10 w-10 rounded-lg bg-[var(--brand-blue)] hover:bg-blue-700 text-[var(--text-primary)] flex items-center justify-center transition-colors shadow-lg disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7"></path></svg>
          </button>
        </div>
      </div>

    </div>
  );
}
