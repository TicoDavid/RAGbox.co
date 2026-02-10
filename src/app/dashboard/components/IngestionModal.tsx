"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface IngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileUpload?: (files: File[]) => void;
  onUrlSubmit?: (url: string, options?: { captureAsPdf?: boolean; followLinks?: boolean }) => void;
  onTextPaste?: (text: string) => void;
}

// ============================================================================
// ICONS
// ============================================================================

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const LocalFilesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
);

const WebIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const CloudIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
  </svg>
);

const TextIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7"/>
    <line x1="9" y1="20" x2="15" y2="20"/>
    <line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
);

const DocumentIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const FetchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

const IngestIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

// ============================================================================
// TYPES
// ============================================================================

type SourceType = 'local' | 'web' | 'cloud' | 'text';

interface StagedItem {
  id: string;
  name: string;
  type: 'file' | 'url' | 'text';
  size?: number;
  file?: File;
  url?: string;
  text?: string;
}

interface SourceOption {
  id: SourceType;
  label: string;
  subtext: string;
  icon: React.FC;
}

const SOURCES: SourceOption[] = [
  { id: 'local', label: 'Local Files', subtext: 'PDF, DOCX, CSV from device.', icon: LocalFilesIcon },
  { id: 'web', label: 'Sovereign Web', subtext: 'Scrape & Freeze URLs.', icon: WebIcon },
  { id: 'cloud', label: 'Cloud Drives', subtext: 'SharePoint / OneDrive.', icon: CloudIcon },
  { id: 'text', label: 'Raw Text', subtext: 'Paste clipboard data.', icon: TextIcon },
];

// ============================================================================
// HELPERS
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname;
  } catch {
    return url;
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const IngestionModal: React.FC<IngestionModalProps> = ({
  isOpen,
  onClose,
  onFileUpload,
  onUrlSubmit,
  onTextPaste,
}) => {
  const [activeSource, setActiveSource] = useState<SourceType>('local');
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [captureAsPdf, setCaptureAsPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStagedItems([]);
        setUrlInput('');
        setTextInput('');
        setActiveSource('local');
      }, 300);
    }
  }, [isOpen]);

  // ========== FILE HANDLERS ==========
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
    const newItems: StagedItem[] = files.map(file => ({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: 'file',
      size: file.size,
      file,
    }));
    setStagedItems(prev => [...prev, ...newItems]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newItems: StagedItem[] = files.map(file => ({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: 'file',
      size: file.size,
      file,
    }));
    setStagedItems(prev => [...prev, ...newItems]);
    e.target.value = ''; // Reset input
  }, []);

  // ========== URL HANDLER ==========
  const handleAddUrl = useCallback(() => {
    if (!urlInput.trim()) return;
    const url = urlInput.trim();
    const newItem: StagedItem = {
      id: `url-${Date.now()}`,
      name: extractDomain(url),
      type: 'url',
      url,
    };
    setStagedItems(prev => [...prev, newItem]);
    setUrlInput('');
  }, [urlInput]);

  // ========== TEXT HANDLER ==========
  const handleAddText = useCallback(() => {
    if (!textInput.trim()) return;
    const newItem: StagedItem = {
      id: `text-${Date.now()}`,
      name: `Text snippet (${textInput.length} chars)`,
      type: 'text',
      text: textInput.trim(),
    };
    setStagedItems(prev => [...prev, newItem]);
    setTextInput('');
  }, [textInput]);

  // ========== REMOVE ITEM ==========
  const handleRemoveItem = useCallback((id: string) => {
    setStagedItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // ========== INGEST ==========
  const handleIngest = useCallback(() => {
    // Process files
    const files = stagedItems.filter(item => item.type === 'file' && item.file).map(item => item.file!);
    if (files.length > 0 && onFileUpload) {
      onFileUpload(files);
    }

    // Process URLs
    const urls = stagedItems.filter(item => item.type === 'url' && item.url);
    urls.forEach(item => {
      if (onUrlSubmit && item.url) {
        onUrlSubmit(item.url, { captureAsPdf });
      }
    });

    // Process text
    const texts = stagedItems.filter(item => item.type === 'text' && item.text);
    texts.forEach(item => {
      if (onTextPaste && item.text) {
        onTextPaste(item.text);
      }
    });

    // Close modal
    onClose();
  }, [stagedItems, onFileUpload, onUrlSubmit, onTextPaste, captureAsPdf, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-xl"
        />

        {/* Modal - The Data Airlock */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[800px] h-[560px] bg-[#060a12] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col"
        >
          {/* Top Edge Light */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Data Airlock</h2>
              <p className="text-xs text-slate-500 mt-0.5">Inspect cargo before ingestion</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Body - 2-Column Grid */}
          <div className="flex-1 grid grid-cols-[220px_1fr] min-h-0 overflow-hidden">

            {/* ========== LEFT PANEL: Source Menu - Dark Midnight ========== */}
            <nav className="bg-[#030508] border-r border-white/5 py-4 overflow-y-auto">
              <div className="px-4 mb-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Source</p>
              </div>
              <div className="space-y-1 px-2">
                {SOURCES.map((source) => {
                  const Icon = source.icon;
                  const isActive = activeSource === source.id;
                  return (
                    <button
                      key={source.id}
                      onClick={() => setActiveSource(source.id)}
                      className={`
                        w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-all duration-200
                        ${isActive
                          ? 'bg-white/5 border-l-4 border-[#2463EB]'
                          : 'border-l-4 border-transparent hover:bg-white/5'
                        }
                      `}
                    >
                      <div className={`mt-0.5 ${isActive ? 'text-[#60A5FA]' : 'text-slate-500'}`}>
                        <Icon />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isActive ? 'text-white' : 'text-slate-300'}`}>
                          {source.label}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{source.subtext}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* ========== RIGHT PANEL: The Stage ========== */}
            <div className="relative flex flex-col min-h-0 overflow-hidden">
              {/* Spotlight Gradient */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,_rgba(212,175,55,0.08)_0%,_transparent_60%)]" />

              {/* Stage Header */}
              <div className="relative shrink-0 px-5 py-3 border-b border-white/5">
                <h3 className="text-sm font-semibold text-white">
                  {activeSource === 'local' && 'Upload Local Files'}
                  {activeSource === 'web' && 'Web Scraper Configuration'}
                  {activeSource === 'cloud' && 'Cloud Drive Connection'}
                  {activeSource === 'text' && 'Raw Text Input'}
                </h3>
              </div>

              {/* Stage Content */}
              <div className="relative flex-1 overflow-y-auto p-5">

                {/* LOCAL FILES: Drop Zone */}
                {activeSource === 'local' && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      flex flex-col items-center justify-center gap-4 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 min-h-[200px]
                      ${isDragOver
                        ? 'border-[#2463EB] bg-[#2463EB]/10 shadow-[0_0_40px_-10px_rgba(36,99,235,0.5)]'
                        : 'border-slate-700/50 hover:border-[#2463EB]/50 hover:bg-[#2463EB]/5'
                      }
                    `}
                  >
                    <div className={`transition-all ${isDragOver ? 'text-[#60A5FA] scale-110' : 'text-slate-600'}`}>
                      <DocumentIcon />
                    </div>
                    <div className="text-center">
                      <p className={`font-semibold ${isDragOver ? 'text-[#60A5FA]' : 'text-slate-400'}`}>
                        {isDragOver ? 'Release to stage' : 'Drag & drop files here'}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        or <span className="text-[#60A5FA]">click to browse</span>
                      </p>
                    </div>
                    <p className="text-xs text-slate-600">PDF, DOCX, TXT, MD, CSV, XLSX</p>
                  </div>
                )}

                {/* WEB: URL Input */}
                {activeSource === 'web' && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                        placeholder="Enter URL to capture..."
                        className="flex-1 h-12 px-4 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#2463EB] focus:ring-1 focus:ring-[#2463EB]"
                      />
                      <button
                        onClick={handleAddUrl}
                        disabled={!urlInput.trim()}
                        className="px-4 h-12 bg-[#2463EB] hover:bg-[#3b7aff] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center gap-2"
                      >
                        <FetchIcon />
                        Capture
                      </button>
                    </div>

                    {/* Capture Options */}
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Capture Options</p>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!captureAsPdf}
                          onChange={() => setCaptureAsPdf(false)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#2463EB] focus:ring-[#2463EB]"
                        />
                        <div>
                          <p className="text-sm text-white">Extract Text Only</p>
                          <p className="text-xs text-slate-500">RAG optimized for AI queries</p>
                        </div>
                        <span className="ml-auto px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded">Recommended</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={captureAsPdf}
                          onChange={() => setCaptureAsPdf(true)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#2463EB] focus:ring-[#2463EB]"
                        />
                        <div>
                          <p className="text-sm text-white">Capture as PDF</p>
                          <p className="text-xs text-slate-500">Visual snapshot with layout</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* CLOUD: Connect Account (Mocked) */}
                {activeSource === 'cloud' && (
                  <div className="flex flex-col items-center justify-center min-h-[200px] p-8 rounded-xl border border-dashed border-slate-700/50">
                    <CloudIcon />
                    <p className="text-slate-400 font-medium mt-4">Connect Cloud Storage</p>
                    <p className="text-sm text-slate-500 mt-1 text-center max-w-xs">
                      Link your SharePoint or OneDrive account to browse and import documents.
                    </p>
                    <button className="mt-4 px-6 py-2.5 bg-[#2463EB] hover:bg-[#3b7aff] text-white font-medium rounded-lg transition-all">
                      Connect Account
                    </button>
                    <p className="text-xs text-slate-600 mt-3">Coming Soon</p>
                  </div>
                )}

                {/* TEXT: Paste Area */}
                {activeSource === 'text' && (
                  <div className="space-y-3">
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Paste your text content here..."
                      className="w-full h-40 p-4 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#2463EB] focus:ring-1 focus:ring-[#2463EB] resize-none"
                    />
                    <button
                      onClick={handleAddText}
                      disabled={!textInput.trim()}
                      className="px-6 py-2.5 bg-[#2463EB] hover:bg-[#3b7aff] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all"
                    >
                      Add to Staging
                    </button>
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* ========== STAGING AREA (Manifest) ========== */}
              <div className="relative shrink-0 border-t border-white/5 bg-[#050810]">
                <div className="px-5 py-2 border-b border-white/5 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Staging Manifest
                  </p>
                  <p className="text-xs text-slate-600">
                    {stagedItems.length} item{stagedItems.length !== 1 ? 's' : ''} ready
                  </p>
                </div>

                <div className="max-h-[120px] overflow-y-auto">
                  {stagedItems.length === 0 ? (
                    <div className="px-5 py-4 text-center">
                      <p className="text-sm text-slate-600">No items staged for ingestion</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {stagedItems.map((item) => (
                        <div key={item.id} className="px-5 py-2 flex items-center gap-3 hover:bg-white/5">
                          <div className="text-slate-500">
                            {item.type === 'file' && <FileIcon />}
                            {item.type === 'url' && <LinkIcon />}
                            {item.type === 'text' && <TextIcon />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{item.name}</p>
                          </div>
                          {item.size && (
                            <p className="text-xs text-slate-500">{formatFileSize(item.size)}</p>
                          )}
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded">
                            Ready
                          </span>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ========== FOOTER: Ingest Action ========== */}
          <div className="shrink-0 px-6 py-4 bg-[#030508] border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-slate-600">
              End-to-end encrypted • Sovereign copy retained
            </p>
            <button
              onClick={handleIngest}
              disabled={stagedItems.length === 0}
              className={`
                px-8 py-3 font-bold text-sm rounded-lg transition-all duration-300 flex items-center gap-2
                ${stagedItems.length > 0
                  ? 'bg-[#D4AF37] hover:bg-[#E5C04B] text-black shadow-[0_0_30px_-5px_rgba(212,175,55,0.6)]'
                  : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                }
              `}
            >
              <IngestIcon />
              INGEST EVIDENCE
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default IngestionModal;
