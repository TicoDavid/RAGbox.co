'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Sovereign Workspace Dashboard
 *
 * Two States:
 * 1. Zero State: User logged in but no documents uploaded yet
 * 2. Active State: Split-screen Document + AI view ("Minority Report")
 *
 * Design Goal: "Minority Report" for Business
 */

// Icons for the sidebar navigation
const Icons = {
  Home: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  ),
  Vault: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
  Send: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M5 12h14M12 5l7 7-7 7"
      />
    </svg>
  ),
  Lightning: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  Document: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  ),
  Upload: () => (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  ),
  Box: () => (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  ),
}

type NavItem = 'Home' | 'Vault' | 'Settings'

interface Document {
  id: string
  name: string
  uploadedAt: Date
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<NavItem>('Home')
  const [inputValue, setInputValue] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const navItems: NavItem[] = ['Home', 'Vault', 'Settings']

  // Check if user has documents (determines Zero vs Active state)
  const hasDocuments = documents.length > 0

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [])

  const handleFileUpload = (file: File) => {
    setIsUploading(true)
    // Simulate upload
    setTimeout(() => {
      setDocuments([
        {
          id: '1',
          name: file.name,
          uploadedAt: new Date(),
        },
      ])
      setIsUploading(false)
    }, 1500)
  }

  const handleFileSelect = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.doc,.docx,.txt'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        handleFileUpload(file)
      }
    }
    input.click()
  }

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden selection:bg-blue-500/30 font-sans">
      {/* 1. SIDEBAR (The Navigation Rail) */}
      <motion.aside
        className="w-16 md:w-20 border-r border-white/10 flex flex-col items-center py-6 gap-8 bg-[#0A0A0A]"
        initial={{ x: -80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Brand Icon (Small) - White container for blue logo */}
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/20">
          <img
            src="https://storage.googleapis.com/connexusai-assets/BlueLogo_RAGbox.co.png"
            className="w-6 h-auto"
            alt="RAGbox Logo"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src =
                'https://storage.googleapis.com/connexusai-assets/WhiteLogo_RAGbox.co-removebg-preview.png'
              target.classList.add('invert')
            }}
          />
        </div>

        {/* Nav Items */}
        <nav className="flex flex-col gap-6 w-full items-center">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => setActiveTab(item)}
              className={cn(
                'p-3 rounded-xl transition-all duration-200',
                activeTab === item
                  ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
              )}
              aria-label={item}
            >
              {Icons[item]()}
            </button>
          ))}
        </nav>
      </motion.aside>

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <motion.header
          className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#050505]/50 backdrop-blur-md z-10"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">My Vault</span>
            {hasDocuments && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-white font-medium">{documents[0].name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-emerald-500 tracking-wider">
              SECURE CONNECTION
            </span>
          </div>
        </motion.header>

        <AnimatePresence mode="wait">
          {!hasDocuments ? (
            /* ZERO STATE: No documents uploaded yet */
            <motion.div
              key="zero-state"
              className="flex-1 flex items-center justify-center p-8"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div
                className={cn(
                  'w-full max-w-2xl p-12 rounded-3xl',
                  'bg-[#0A0A0A] border-2 border-dashed',
                  'flex flex-col items-center justify-center gap-6',
                  'cursor-pointer transition-all duration-300',
                  isDragOver
                    ? 'border-blue-500 bg-blue-500/5 scale-[1.02]'
                    : 'border-white/10 hover:border-white/20'
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleFileSelect}
              >
                {/* Animated Box Icon */}
                <motion.div
                  className={cn(
                    'text-slate-600',
                    isDragOver && 'text-blue-500'
                  )}
                  animate={
                    isUploading
                      ? { rotate: 360, scale: [1, 1.1, 1] }
                      : isDragOver
                        ? { scale: 1.1, y: -5 }
                        : { scale: 1, y: 0 }
                  }
                  transition={
                    isUploading
                      ? { duration: 1, repeat: Infinity, ease: 'linear' }
                      : { type: 'spring', stiffness: 300, damping: 30 }
                  }
                >
                  <Icons.Box />
                </motion.div>

                {/* Text */}
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {isUploading
                      ? 'Processing Document...'
                      : isDragOver
                        ? 'Release to Upload'
                        : 'Feed the Vault'}
                  </h2>
                  <p className="text-slate-500 max-w-md">
                    {isUploading
                      ? 'Analyzing and indexing your document for sovereign interrogation'
                      : 'Drop your confidential documents here or click to browse. PDF, DOCX, and TXT supported.'}
                  </p>
                </div>

                {/* Upload Button */}
                {!isUploading && !isDragOver && (
                  <motion.button
                    className={cn(
                      'px-6 py-3 rounded-2xl',
                      'bg-blue-600 hover:bg-blue-500',
                      'text-white font-semibold',
                      'shadow-[0_0_20px_rgba(37,99,235,0.3)]',
                      'hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]',
                      'transition-all duration-200',
                      'flex items-center gap-2'
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFileSelect()
                    }}
                  >
                    <Icons.Upload />
                    <span>Select Document</span>
                  </motion.button>
                )}

                {/* Loading Indicator */}
                {isUploading && (
                  <div className="flex items-center gap-3">
                    <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 1.5, ease: 'easeInOut' }}
                      />
                    </div>
                  </div>
                )}

                {/* Trust Badge */}
                <div className="flex items-center gap-2 mt-4">
                  <svg
                    className="w-4 h-4 text-emerald-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span className="text-xs text-slate-500">
                    AES-256 Encryption • Zero Data Retention
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ACTIVE STATE: Split-screen Document + AI */
            <motion.div
              key="active-state"
              className="flex-1 flex overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* LEFT PANEL: DOCUMENT VIEWER */}
              <motion.div
                className="w-1/2 border-r border-white/10 bg-[#0A0A0A] relative flex flex-col"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.2 }}
              >
                {/* Toolbar */}
                <div className="h-10 border-b border-white/5 flex items-center px-4 gap-4 text-slate-500 text-xs">
                  <button className="hover:text-white transition-colors">Zoom In</button>
                  <button className="hover:text-white transition-colors">Zoom Out</button>
                  <div className="flex-1" />
                  <span>Page 1 of 12</span>
                </div>

                {/* The Document Canvas */}
                <div className="flex-1 p-8 overflow-y-auto flex justify-center bg-[#111]">
                  <div className="w-full max-w-xl h-[800px] bg-white text-black p-8 shadow-2xl rounded-sm opacity-90">
                    {/* Placeholder PDF Content */}
                    <h1 className="text-2xl font-bold mb-4 font-serif">
                      Q3 Financial Performance
                    </h1>
                    <p className="font-serif text-sm leading-relaxed text-gray-800">
                      This document contains confidential proprietary information. Revenue
                      growth exceeded projections by 14% largely due to the adoption of
                      AI-driven efficiencies in the logistics sector...
                    </p>
                    <div className="mt-8 h-40 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                      [CHART DATA VISUALIZATION]
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* RIGHT PANEL: INTELLIGENCE CHAT */}
              <motion.div
                className="w-1/2 bg-[#050505] flex flex-col relative"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.3 }}
              >
                {/* Chat Feed */}
                <div className="flex-1 p-6 overflow-y-auto space-y-6">
                  {/* Message: AI Welcome */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                      <Icons.Lightning />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-slate-400">
                        RAGBox Intelligence
                      </div>
                      <div className="text-slate-200 text-sm leading-relaxed max-w-lg">
                        I&apos;ve analyzed{' '}
                        <span className="text-blue-400 bg-blue-400/10 px-1 rounded">
                          {documents[0]?.name || 'your document'}
                        </span>
                        . I detected 3 key revenue drivers and a risk factor in the logistics
                        chart. What would you like to know?
                      </div>
                      {/* Suggestions */}
                      <div className="flex gap-2 pt-2 flex-wrap">
                        <button className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors">
                          Summarize Risks
                        </button>
                        <button className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors">
                          Extract Revenue Table
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Message: User */}
                  <div className="flex flex-row-reverse gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-xs text-white font-medium">
                      YO
                    </div>
                    <div className="bg-[#1A1A1A] p-3 rounded-2xl rounded-tr-sm text-sm text-white max-w-md border border-white/5">
                      What was the exact percentage of growth in logistics?
                    </div>
                  </div>

                  {/* Message: AI Response with Citation */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                      <Icons.Lightning />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-slate-400">
                        RAGBox Intelligence
                      </div>
                      <div className="text-slate-200 text-sm leading-relaxed max-w-lg">
                        The report indicates a revenue growth of{' '}
                        <strong className="text-white">14%</strong> specifically attributed
                        to AI efficiencies in the logistics sector.
                      </div>
                      {/* Citation Card */}
                      <div className="mt-2 p-3 rounded-lg bg-emerald-900/10 border border-emerald-500/20 flex items-start gap-3 cursor-pointer hover:bg-emerald-900/20 transition-colors">
                        <div className="mt-0.5 text-emerald-500">
                          <Icons.Document />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-emerald-500 uppercase tracking-wide">
                            Source Verified
                          </div>
                          <div className="text-xs text-slate-400 line-clamp-1">
                            Page 1 &bull; &quot;...exceeded projections by 14% largely due
                            to...&quot;
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input Area */}
                <div className="p-6 pt-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Ask your vault..."
                      className={cn(
                        'w-full h-14 pl-5 pr-12 rounded-2xl',
                        'bg-[#111] border border-white/10',
                        'text-white placeholder-slate-600',
                        'focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600',
                        'transition-all shadow-xl'
                      )}
                    />
                    <button
                      className={cn(
                        'absolute right-2 top-2 h-10 w-10 rounded-xl',
                        'bg-blue-600 hover:bg-blue-500',
                        'text-white flex items-center justify-center',
                        'transition-colors'
                      )}
                    >
                      <Icons.Send />
                    </button>
                  </div>
                  <div className="text-center mt-3">
                    <p className="text-[10px] text-slate-600">
                      RAGBox Sovereign Engine v2.1 &bull; Zero-Retention Mode Active
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
