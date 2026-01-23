"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdvancedChat from './components/AdvancedChat';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [hasDocument, setHasDocument] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  // Redirect to home if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Show loading while checking auth
  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated
  if (!session) {
    return null;
  }

  // Simulated Upload
  const handleUpload = () => {
    setTimeout(() => setHasDocument(true), 800);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white overflow-hidden font-sans selection:bg-blue-500/30 transition-colors duration-300">

      {/* BACKGROUND TEXTURE (Grid) */}
      <div className="absolute inset-0 pointer-events-none z-0">
         <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-0" />
         <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px] opacity-0 dark:opacity-100" />
      </div>

      {/* 1. SIDEBAR (Fixed Rail) */}
      <aside className="w-20 border-r border-slate-200 dark:border-white/10 flex flex-col items-center py-6 gap-8 bg-white dark:bg-[#0A0A0A] z-20 shadow-xl shadow-slate-200/20 dark:shadow-none">
        {/* LOGO BOX */}
        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/10 border border-slate-100 dark:border-transparent">
           <img src="https://storage.googleapis.com/connexusai-assets/BlueLogo_RAGbox.co.png" className="w-8 h-auto" alt="Logo" />
        </div>

        <div className="flex flex-col gap-4 w-full items-center">
          {['Home', 'Vault', 'Settings'].map((item) => (
            <button
              key={item}
              onClick={() => setActiveTab(item)}
              className={`p-3 rounded-xl transition-all duration-300 group relative ${
                activeTab === item
                  ? 'bg-blue-50 text-[#0000FF] dark:bg-white/10 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              {/* Dynamic Icons */}
              {item === 'Home' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>}
              {item === 'Vault' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>}
              {item === 'Settings' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
            </button>
          ))}
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col relative z-10 transition-all duration-500">

        {/* TOP HEADER */}
        <header className="h-16 border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-6 bg-white/50 dark:bg-[#050505]/50 backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Workspace</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 dark:text-white font-medium">
              {hasDocument ? 'Q3_Financial_Report.pdf' : 'Overview'}
            </span>
          </div>
          <div className="flex items-center gap-3">
             <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
             <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 tracking-widest uppercase">Encrypted Connection</span>
          </div>
        </header>

        {/* CONTENT SWITCHER */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">

            {/* STATE A: EMPTY STATE (The Glass Drop Zone) */}
            {!hasDocument && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                className="absolute inset-0 flex flex-col items-center justify-center p-8"
              >
                <div
                  onClick={handleUpload}
                  className="
                    group cursor-pointer relative w-full max-w-2xl aspect-[16/9] rounded-3xl
                    bg-white border border-slate-200 shadow-2xl shadow-slate-200/50
                    dark:bg-white/5 dark:border-white/10 dark:shadow-black
                    hover:border-[#0000FF]/50 dark:hover:border-blue-500/50
                    transition-all duration-500 flex flex-col items-center justify-center gap-6
                  "
                >
                  <div className="
                    p-6 rounded-3xl
                    bg-blue-50 text-[#0000FF]
                    dark:bg-[#0A0A0A] dark:border dark:border-white/10 dark:text-blue-500
                    shadow-xl group-hover:scale-110 transition-transform duration-500
                  ">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Initialize Analysis</h3>
                    <p className="text-slate-500 dark:text-slate-400">Drag & drop your file here to enter the vault</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STATE B: ACTIVE WORKSPACE (Split Screen) */}
            {hasDocument && (
              <motion.div
                key="active"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="absolute inset-0 flex"
              >
                {/* LEFT: DOC VIEWER (Simulated) */}
                <div className="w-1/2 border-r border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#111] flex flex-col">
                  <div className="flex-1 p-8 overflow-y-auto flex justify-center">
                    <div className="w-full max-w-xl bg-white min-h-[1000px] shadow-2xl shadow-slate-300 dark:shadow-black p-10 text-black rounded-sm">
                      <h1 className="text-3xl font-bold mb-6 font-serif">Q3 Performance Analysis</h1>
                      <div className="space-y-4 font-serif text-gray-800 leading-relaxed text-lg">
                        <p>This is a simulated view of your uploaded document.</p>
                        <p>The RAGBox engine has indexed 14 key data points from this page.</p>
                        <div className="h-64 bg-slate-50 rounded border border-slate-100 flex items-center justify-center text-slate-400 text-xs tracking-widest mt-8">
                          [DATA VISUALIZATION DETECTED]
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: ADVANCED CHAT (The Brain) */}
                <div className="w-1/2 flex flex-col">
                  <AdvancedChat />
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
