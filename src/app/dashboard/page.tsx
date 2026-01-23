"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import useSound from 'use-sound';
import AdvancedChat from './components/AdvancedChat';

export default function Dashboard() {
  const { theme, setTheme } = useTheme();

  // App State
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [files, setFiles] = useState([
    { name: 'Q3_Performance_Analysis.pdf', size: '2.4 MB', date: 'Just now' },
    { name: 'HR_Compliance_2025.docx', size: '1.1 MB', date: '2 days ago' },
    { name: 'Engineering_Roadmap_v4.pdf', size: '4.2 MB', date: '5 days ago' },
  ]);

  // Sound: Tactile hover click for sidebar
  const [playHover] = useSound(
    'https://storage.googleapis.com/connexusai-assets/sci-fi-whoosh-ui-click-brukowskij-1-00-02.mp3',
    { volume: 0.2 }
  );

  const handleUpload = () => {
    // Simulate upload delay
    setTimeout(() => setCurrentFile('Q3_Performance_Analysis.pdf'), 800);
  };

  const openFile = (fileName: string) => {
    setCurrentFile(fileName);
    setIsVaultOpen(false); // Close drawer on selection
  };

  const handleNavClick = (tab: string) => {
    if (tab === 'Home') setCurrentFile(null); // Go back to Drop Zone
    if (tab === 'Vault') setIsVaultOpen(true);
    if (tab === 'Settings') setIsSettingsOpen(true);
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] dark:bg-[#050505] text-slate-900 dark:text-white overflow-hidden font-sans selection:bg-blue-500/30 transition-colors duration-300">

      {/* BACKGROUND GRID */}
      <div className="absolute inset-0 pointer-events-none z-0">
         <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      {/* --- SIDEBAR RAIL --- */}
      <aside className="w-[72px] flex flex-col items-center py-6 gap-6 bg-[#0F172A] z-30 shadow-2xl border-r border-white/5">

        {/* LOGO: Blue on White (App Icon Style) */}
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 mb-4">
           <img
             src="https://storage.googleapis.com/connexusai-assets/Primary_RagBoxCo_Colored_Black.png"
             className="w-7 h-auto object-contain"
             alt="RAGbox Logo"
           />
        </div>

        {/* NAV ITEMS */}
        <div className="flex flex-col gap-4 w-full items-center">
            <NavButton name="Home" active={!currentFile && !isVaultOpen && !isSettingsOpen} onClick={() => handleNavClick('Home')} onHover={playHover} />
            <NavButton name="Vault" active={isVaultOpen} onClick={() => handleNavClick('Vault')} onHover={playHover} />
            <NavButton name="Settings" active={isSettingsOpen} onClick={() => handleNavClick('Settings')} onHover={playHover} />
        </div>

        <div className="flex-1" />

        {/* THEME TOGGLE */}
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            onMouseEnter={() => playHover()}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
            {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
        </button>
      </aside>

      {/* --- MAIN WORKSPACE --- */}
      <main className="flex-1 flex flex-col relative z-10">

        {/* HEADER */}
        <header className="h-16 border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-6 bg-white/60 dark:bg-[#050505]/60 backdrop-blur-xl z-20">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Workspace</span>
            <svg className="w-4 h-4 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18l6-6-6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-slate-900 dark:text-white font-semibold truncate">
                {currentFile || 'Overview'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20">
             <span className="relative flex h-2 w-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
             </span>
             <span className="text-[10px] font-bold text-amber-700 dark:text-amber-500 tracking-widest uppercase">Sovereign Environment</span>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">

            {/* 1. HOME (DROP ZONE) */}
            {!currentFile && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-8"
              >
                <div
                  onClick={handleUpload}
                  className="group cursor-pointer relative w-full max-w-2xl aspect-[16/9] rounded-3xl bg-white border border-slate-200 shadow-2xl shadow-slate-200/50 dark:bg-[#0A0A0A] dark:border-white/10 dark:shadow-black hover:border-[#0000FF] dark:hover:border-blue-500/50 transition-all duration-500 flex flex-col items-center justify-center gap-6"
                >
                  <div className="p-6 rounded-3xl bg-blue-50 text-[#0000FF] dark:bg-white/5 dark:text-blue-500 shadow-xl group-hover:scale-110 transition-transform">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Upload to Vault</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Click to select a file or drag & drop</p>
                </div>
              </motion.div>
            )}

            {/* 2. ACTIVE WORKSPACE */}
            {currentFile && (
              <motion.div
                key="active"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 flex"
              >
                {/* LEFT: DOC VIEWER */}
                <div className="w-1/2 border-r border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#111] flex flex-col">
                  <div className="flex-1 p-8 overflow-y-auto flex justify-center">
                    <div className="w-full max-w-xl bg-white min-h-[1000px] shadow-2xl p-12 text-black rounded-sm">
                      <h1 className="text-3xl font-bold mb-6 font-serif">Q3 Performance Analysis</h1>
                      <div className="space-y-4 font-serif text-gray-800 text-lg leading-relaxed">
                        <p><strong>Executive Summary:</strong> The third quarter demonstrated resilience in core logistics sectors despite geopolitical headwinds.</p>
                        <p>Revenue increased by <span className="bg-blue-100 px-1">14% year-over-year</span>, driven primarily by the automation initiative.</p>
                        <div className="mt-8 p-6 bg-slate-50 border border-slate-100 rounded text-center text-xs text-slate-400 tracking-widest">[DATA VISUALIZATION]</div>
                        <p>Detailed breakdown of risk factors follows in Section 4...</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: CHAT */}
                <div className="w-1/2 flex flex-col">
                  <AdvancedChat />
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* --- MODALS / DRAWERS --- */}

        {/* VAULT DRAWER */}
        <AnimatePresence>
          {isVaultOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsVaultOpen(false)} className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
              <motion.div initial={{ x: -300 }} animate={{ x: 72 }} exit={{ x: -300 }} className="fixed top-0 bottom-0 left-0 w-80 bg-white dark:bg-[#0F172A] border-r border-slate-200 dark:border-white/10 z-50 p-6 shadow-2xl">
                 <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Sovereign Vault</h2>
                 <div className="space-y-2">
                    {files.map(file => (
                        <button key={file.name} onClick={() => openFile(file.name)} className="w-full text-left p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-3 group transition-colors">
                            <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-blue-400 flex items-center justify-center">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /></svg>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-white truncate w-48">{file.name}</div>
                                <div className="text-[10px] text-slate-400">{file.size} • {file.date}</div>
                            </div>
                        </button>
                    ))}
                 </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* SETTINGS MODAL */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
               <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-[#0F172A] rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-white/10">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Settings</h2>
                  <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-white/5">
                          <span className="text-sm text-slate-700 dark:text-slate-200">Dark Mode</span>
                          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="px-3 py-1 rounded bg-white dark:bg-black border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-white shadow-sm">
                            {theme === 'dark' ? 'ON' : 'OFF'}
                          </button>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-white/5">
                          <span className="text-sm text-slate-700 dark:text-slate-200">Data Retention</span>
                          <span className="text-xs font-mono text-emerald-500">0 DAYS (ACTIVE)</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-white/5">
                          <span className="text-sm text-slate-700 dark:text-slate-200">Encryption</span>
                          <span className="text-xs font-mono text-emerald-500">AES-256</span>
                      </div>
                  </div>
                  <button onClick={() => setIsSettingsOpen(false)} className="mt-6 w-full py-2 rounded-lg bg-[#0000FF] hover:bg-blue-700 text-white font-bold text-sm transition-colors">Close</button>
               </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}

// --- SUB COMPONENTS ---
function NavButton({ name, active, onClick, onHover }: { name: string, active: boolean, onClick: () => void, onHover: () => void }) {
    const icons: Record<string, React.ReactNode> = {
        'Home': <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>,
        'Vault': <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>,
        'Settings': <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></>
    };

    return (
        <button
            onClick={onClick}
            onMouseEnter={onHover}
            className={`p-3 rounded-xl transition-all duration-300 group relative ${
                active
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
        >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">{icons[name]}</svg>
            <span className="absolute left-14 bg-[#0F172A] border border-white/10 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {name}
            </span>
        </button>
    );
}
