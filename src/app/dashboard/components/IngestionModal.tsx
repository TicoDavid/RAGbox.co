"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@/contexts/SettingsContext';

interface IngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileUpload?: (files: File[]) => void;
  onUrlSubmit?: (url: string, options?: { captureAsPdf?: boolean; followLinks?: boolean }) => void;
  onTextPaste?: (text: string) => void;
}

// Scrape status states
type ScrapeStatus = 'idle' | 'connecting' | 'extracting' | 'vectorizing' | 'success' | 'error';

// Source type icons
const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const SharePointIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>
);

const WebsiteIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const PasteIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

// Fetch/Capture button icon - Download bolt
const FetchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// Larger document icon for drop zone
const DocumentIcon = () => (
  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

// Signal/Radar icon for scraping animation
const SignalIcon = ({ className }: { className?: string }) => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49"/>
    <path d="M7.76 16.24a6 6 0 0 1 0-8.49"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M4.93 19.07a10 10 0 0 1 0-14.14"/>
  </svg>
);

// Lock icon for captured state
const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

// Check icon for success
const CheckIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// Shield icon for footer
const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

type SourceType = 'upload' | 'sharepoint' | 'website' | 'paste';

const SOURCE_PILLS = [
  { id: 'upload' as SourceType, label: 'Upload', icon: UploadIcon },
  { id: 'sharepoint' as SourceType, label: 'SharePoint', icon: SharePointIcon },
  { id: 'website' as SourceType, label: 'Website', icon: WebsiteIcon },
  { id: 'paste' as SourceType, label: 'Paste Text', icon: PasteIcon },
];

// URL detection regex
const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

// Extract domain from URL
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname;
  } catch {
    return url;
  }
}

// Generate page title from URL
function generatePageTitle(url: string): string {
  const domain = extractDomain(url);
  const pathMatch = url.match(/\/([^/]+)\/?$/);
  if (pathMatch && pathMatch[1]) {
    return `${pathMatch[1].replace(/[-_]/g, ' ')} - ${domain}`;
  }
  return domain;
}

const IngestionModal: React.FC<IngestionModalProps> = ({
  isOpen,
  onClose,
  onFileUpload,
  onUrlSubmit,
  onTextPaste,
}) => {
  const { hasVerifiedConnection } = useSettings();
  const [activeSource, setActiveSource] = useState<SourceType | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scrape console state
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>('idle');
  const [captureAsPdf, setCaptureAsPdf] = useState(false);
  const [followLinks, setFollowLinks] = useState(false);
  const [scrapedTitle, setScrapedTitle] = useState('');
  const [scrapeProgress, setScrapeProgress] = useState(0);

  // Auto-detect URL and switch to Website mode
  useEffect(() => {
    if (searchValue && URL_REGEX.test(searchValue)) {
      if (activeSource !== 'website') {
        setActiveSource('website');
      }
    }
  }, [searchValue, activeSource]);

  // Reset scrape state when modal closes or source changes
  useEffect(() => {
    if (!isOpen || activeSource !== 'website') {
      setScrapeStatus('idle');
      setScrapeProgress(0);
      setScrapedTitle('');
    }
  }, [isOpen, activeSource]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && onFileUpload) {
      onFileUpload(files);
    }
  }, [onFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && onFileUpload) {
      onFileUpload(files);
    }
  }, [onFileUpload]);

  // Enhanced URL scrape handler with animated states
  const handleUrlScrape = useCallback(async () => {
    if (!searchValue.trim()) return;

    const url = searchValue.trim();
    setScrapedTitle(generatePageTitle(url));

    // State machine for scraping animation
    setScrapeStatus('connecting');
    setScrapeProgress(10);

    // Simulate connection phase
    await new Promise(r => setTimeout(r, 800));
    setScrapeStatus('extracting');
    setScrapeProgress(40);

    // Simulate extraction phase
    await new Promise(r => setTimeout(r, 1200));
    setScrapeStatus('vectorizing');
    setScrapeProgress(75);

    // Simulate vectorizing phase
    await new Promise(r => setTimeout(r, 1000));
    setScrapeProgress(100);
    setScrapeStatus('success');

    // Call the actual handler
    if (onUrlSubmit) {
      onUrlSubmit(url, { captureAsPdf, followLinks });
    }

    // Keep success state visible for a moment
    await new Promise(r => setTimeout(r, 2000));

    // Reset for next capture
    setSearchValue('');
    setScrapeStatus('idle');
    setScrapeProgress(0);
  }, [searchValue, onUrlSubmit, captureAsPdf, followLinks]);

  const handleTextSubmit = useCallback(() => {
    if (pasteText.trim() && onTextPaste) {
      onTextPaste(pasteText.trim());
      setPasteText('');
      setActiveSource(null);
    }
  }, [pasteText, onTextPaste]);

  const handleSourceClick = (sourceId: SourceType) => {
    if (sourceId === 'upload') {
      fileInputRef.current?.click();
    } else {
      setActiveSource(activeSource === sourceId ? null : sourceId);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && activeSource === 'website' && searchValue.trim()) {
      e.preventDefault();
      handleUrlScrape();
    }
  };

  // Determine placeholder text based on active source
  const getPlaceholderText = () => {
    if (activeSource === 'website') {
      return 'Enter URL to capture sovereign copy...';
    }
    return 'Paste URL or search connected drives...';
  };

  // Check if Fetch button should be visible
  const showFetchButton = searchValue.trim().length > 0 && activeSource === 'website';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop - Deep space with heavy blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-xl"
        />

        {/* Modal Container - The Glass HUD */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[600px] bg-[#0B1221]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
        >
          {/* Rim Light - Top edge catch */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Header - Glass Edge Separator */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <h2 className="text-xl font-semibold text-white tracking-tight">Add to Vault</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {/* Search/URL Input - Command Line with Fetch Button */}
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#60A5FA] transition-colors">
                <SearchIcon />
              </div>
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={getPlaceholderText()}
                disabled={scrapeStatus !== 'idle' && scrapeStatus !== 'success'}
                className="w-full h-14 pl-12 pr-16 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#2463EB] focus:ring-2 focus:ring-[#2463EB]/30 focus:shadow-[0_0_30px_-5px_rgba(36,99,235,0.4)] transition-all duration-300 disabled:opacity-50"
              />

              {/* Fetch Button - Appears when text is entered in Website mode */}
              <AnimatePresence>
                {showFetchButton && scrapeStatus === 'idle' && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={handleUrlScrape}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-[#2463EB] hover:bg-[#60A5FA] text-white rounded-lg transition-all duration-200 shadow-[0_0_15px_-3px_rgba(36,99,235,0.5)] hover:shadow-[0_0_20px_-3px_rgba(96,165,250,0.6)]"
                    title="Capture URL (Enter)"
                  >
                    <FetchIcon />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Source Pills - Tactical Buttons */}
            <div className="flex flex-wrap gap-2">
              {SOURCE_PILLS.map((source) => {
                const Icon = source.icon;
                const isActive = activeSource === source.id;
                return (
                  <button
                    key={source.id}
                    onClick={() => handleSourceClick(source.id)}
                    disabled={scrapeStatus !== 'idle' && scrapeStatus !== 'success'}
                    className={`
                      flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-50
                      ${isActive
                        ? 'bg-[#2463EB] text-white border border-[#2463EB] shadow-[0_0_20px_-5px_rgba(36,99,235,0.6)]'
                        : 'bg-slate-800/50 border border-transparent text-slate-300 hover:bg-slate-800 hover:border-blue-500/50 hover:text-white hover:shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]'
                      }
                    `}
                  >
                    <Icon />
                    {source.label}
                  </button>
                );
              })}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Paste Text Area (conditional) */}
            {activeSource === 'paste' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste your text content here..."
                  className="w-full h-32 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#2463EB] focus:ring-2 focus:ring-[#2463EB]/30 focus:shadow-[0_0_30px_-5px_rgba(36,99,235,0.4)] transition-all duration-300 resize-none"
                />
                <button
                  onClick={handleTextSubmit}
                  disabled={!pasteText.trim()}
                  className="px-6 py-2.5 bg-[#2463EB] hover:bg-[#60A5FA] text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_-5px_rgba(96,165,250,0.5)]"
                >
                  Add to Vault
                </button>
              </motion.div>
            )}

            {/* DYNAMIC ZONE: Drop Zone OR Scrape Console */}
            <AnimatePresence mode="wait">
              {activeSource === 'website' ? (
                /* ========== SCRAPE CONSOLE ========== */
                <motion.div
                  key="scrape-console"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl border border-slate-700/50 bg-slate-900/30 overflow-hidden"
                >
                  {/* State A: Ready / Idle */}
                  {scrapeStatus === 'idle' && (
                    <div className="p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                          <SignalIcon className="text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-base font-medium text-white">Ready to Capture</p>
                          <p className="text-sm text-slate-400">Enter a URL and press Enter to begin scraping</p>
                        </div>
                      </div>

                      {/* Capture Options */}
                      <div className="space-y-3 pt-2 border-t border-white/5">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Capture Options</p>

                        <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={!captureAsPdf}
                            onChange={() => setCaptureAsPdf(false)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#2463EB] focus:ring-[#2463EB] focus:ring-offset-0"
                          />
                          <div>
                            <p className="text-sm font-medium text-white">Extract Text Only</p>
                            <p className="text-xs text-slate-400">RAG optimized - clean text for AI queries</p>
                          </div>
                          <span className="ml-auto px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded">Recommended</span>
                        </label>

                        <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={captureAsPdf}
                            onChange={() => setCaptureAsPdf(true)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#2463EB] focus:ring-[#2463EB] focus:ring-offset-0"
                          />
                          <div>
                            <p className="text-sm font-medium text-white">Capture as PDF</p>
                            <p className="text-xs text-slate-400">Visual snapshot - preserves layout</p>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors border border-amber-500/20">
                          <input
                            type="checkbox"
                            checked={followLinks}
                            onChange={(e) => setFollowLinks(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
                          />
                          <div>
                            <p className="text-sm font-medium text-amber-400">Follow Sub-Links</p>
                            <p className="text-xs text-slate-400">Crawl immediate links (1 layer deep)</p>
                          </div>
                          <span className="ml-auto px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">Beta</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* State B: Processing */}
                  {(scrapeStatus === 'connecting' || scrapeStatus === 'extracting' || scrapeStatus === 'vectorizing') && (
                    <div className="p-6 space-y-4">
                      <div className="flex items-center gap-4">
                        {/* Pulsing Signal Icon */}
                        <div className="relative">
                          <div className="absolute inset-0 animate-ping opacity-30">
                            <SignalIcon className="text-cyan-400" />
                          </div>
                          <SignalIcon className="text-cyan-400 relative animate-pulse" />
                        </div>
                        <div className="flex-1">
                          <p className="text-base font-medium text-white">
                            {scrapeStatus === 'connecting' && 'Connecting to Source...'}
                            {scrapeStatus === 'extracting' && 'Extracting Content...'}
                            {scrapeStatus === 'vectorizing' && 'Vectorizing for RAG...'}
                          </p>
                          <p className="text-sm text-slate-400 truncate">{extractDomain(searchValue)}</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${scrapeProgress}%` }}
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>
                            {scrapeStatus === 'connecting' && 'Establishing connection...'}
                            {scrapeStatus === 'extracting' && 'Sanitizing HTML...'}
                            {scrapeStatus === 'vectorizing' && 'Creating embeddings...'}
                          </span>
                          <span>{scrapeProgress}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* State C: Success */}
                  {scrapeStatus === 'success' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-6"
                    >
                      <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                        <div className="p-3 rounded-full bg-emerald-500/20">
                          <CheckIcon />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-medium text-emerald-400 truncate">{scrapedTitle}</p>
                            <LockIcon />
                          </div>
                          <p className="text-sm text-slate-400">Captured and secured in Vault</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ) : activeSource !== 'paste' ? (
                /* ========== DROP ZONE (File Upload) ========== */
                <motion.div
                  key="drop-zone"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    group flex flex-col items-center justify-center gap-4 p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300
                    ${isDragOver
                      ? 'border-[#2463EB] bg-[#2463EB]/10 shadow-[0_0_40px_-10px_rgba(36,99,235,0.5)]'
                      : 'bg-blue-950/5 border-slate-700/50 hover:border-[#2463EB]/70 hover:bg-[#2463EB]/5'
                    }
                  `}
                >
                  {/* Large Icon - The Beacon */}
                  <div className={`transition-all duration-300 ${isDragOver ? 'text-[#60A5FA] scale-110 drop-shadow-[0_0_15px_rgba(96,165,250,0.6)]' : 'text-slate-600 group-hover:text-slate-500'}`}>
                    <DocumentIcon />
                  </div>
                  <div className="text-center">
                    <p className={`font-semibold text-base transition-colors ${isDragOver ? 'text-[#60A5FA]' : 'text-slate-400 group-hover:text-slate-300'}`}>
                      {isDragOver ? 'Release to upload' : 'Drag & drop files here'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      or <span className="text-[#60A5FA] hover:underline">click to browse</span>
                    </p>
                  </div>
                  <p className="text-xs text-slate-600">
                    PDF, DOC, DOCX, TXT, MD, CSV, XLSX
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Footer - Trust Signal / Status Bar */}
          <div className="px-6 py-4 bg-black/30 border-t border-white/5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3 text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">
                    <ShieldIcon />
                  </span>
                  <span>End-to-end encrypted</span>
                </div>
                {hasVerifiedConnection && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                    <span className="font-medium">Enhanced OCR: Active</span>
                  </div>
                )}
              </div>
              <span className="text-slate-500">
                {activeSource === 'website' ? 'Sovereign copy - offline after capture' : 'Max file size: 50MB'}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default IngestionModal;
