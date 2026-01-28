"use client";

import React from 'react';
import { Search, BookOpen, FileText, ExternalLink, Copy, Check, X } from 'lucide-react';

// Types
export interface Citation {
  id: number;
  text: string;
  source: string;
  page?: number;
  confidence?: number;
  documentId?: string;
}

interface VerificationPanelProps {
  citation: Citation | null;
  onClear: () => void;
  onViewDocument?: (documentId: string) => void;
}

export default function VerificationPanel({ citation, onClear, onViewDocument }: VerificationPanelProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (citation?.text) {
      navigator.clipboard.writeText(citation.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Empty State
  if (!citation) {
    return (
      <div className="flex flex-col h-full bg-carbon/20 min-w-0">
        {/* Header */}
        <div className="h-12 border-b border-border flex items-center px-4 bg-carbon/30 shrink-0">
          <span className="font-header text-sm font-bold tracking-wider text-gray-400 uppercase">
            Verification
          </span>
        </div>

        {/* Empty Content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="w-16 h-16 rounded-full bg-steel/50 flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-gray-700" />
          </div>
          <h3 className="font-header text-gray-500 text-lg mb-2">No Active Citation</h3>
          <p className="font-mono text-xs text-gray-600 max-w-[200px] leading-relaxed">
            Select a claim in the interrogation stream to verify source evidence.
          </p>
        </div>
      </div>
    );
  }

  // Active Citation State
  return (
    <div className="flex flex-col h-full bg-carbon/20 min-w-0">
      {/* Header with Clear Button */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-carbon/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-header text-sm font-bold tracking-wider text-cyan uppercase">
            Source [{citation.id}]
          </span>
          {citation.confidence !== undefined && (
            <span className={`
              font-mono text-[10px] px-1.5 py-0.5 rounded
              ${citation.confidence >= 0.85
                ? 'bg-emerald/20 text-emerald border border-emerald/30'
                : 'bg-amber/20 text-amber border border-amber/30'}
            `}>
              {Math.round(citation.confidence * 100)}%
            </span>
          )}
        </div>
        <button
          onClick={onClear}
          className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
          title="Clear citation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-800">

        {/* Source Document Info */}
        <div className="flex items-start gap-3 p-3 bg-oled border border-border rounded-lg">
          <div className="w-10 h-10 rounded bg-cyan/10 border border-cyan/20 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-cyan" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-sans text-sm text-gray-200 truncate">{citation.source}</div>
            <div className="flex items-center gap-2 mt-1">
              {citation.page && (
                <span className="font-mono text-[10px] text-gray-500">Page {citation.page}</span>
              )}
              {citation.documentId && onViewDocument && (
                <button
                  onClick={() => onViewDocument(citation.documentId!)}
                  className="font-mono text-[10px] text-cyan hover:underline flex items-center gap-1"
                >
                  View <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Source Excerpt */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">
              Source Excerpt
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 font-mono text-[10px] text-gray-500 hover:text-cyan transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald" />
                  <span className="text-emerald">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="bg-oled border border-cyan/20 rounded-lg p-4 relative">
            {/* Quote marks */}
            <div className="absolute top-2 left-3 text-cyan/20 text-4xl font-serif leading-none">"</div>
            <p className="text-sm text-gray-300 leading-relaxed font-mono pl-6 pr-2">
              {citation.text}
            </p>
            <div className="absolute bottom-2 right-3 text-cyan/20 text-4xl font-serif leading-none">"</div>
          </div>
        </div>

        {/* Document Preview Placeholder */}
        <div className="space-y-2">
          <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">
            Document Preview
          </span>
          <div className="border border-dashed border-gray-700 rounded-lg p-8 flex flex-col items-center justify-center bg-steel/10">
            <BookOpen className="w-10 h-10 text-gray-700 mb-3" />
            <span className="font-mono text-xs text-gray-600">Preview Unavailable</span>
            <span className="font-mono text-[10px] text-gray-700 mt-1">Connect Document Viewer</span>
          </div>
        </div>

        {/* Verification Actions */}
        <div className="pt-2 space-y-2">
          <button className="w-full flex items-center justify-center gap-2 p-3 rounded border border-cyan/30 bg-cyan/5 hover:bg-cyan/10 text-cyan font-mono text-xs uppercase tracking-wider transition-colors">
            <Check className="w-4 h-4" />
            Mark as Verified
          </button>
          <button className="w-full flex items-center justify-center gap-2 p-3 rounded border border-gray-700 hover:border-amber hover:bg-amber/5 text-gray-500 hover:text-amber font-mono text-xs uppercase tracking-wider transition-colors">
            Flag for Review
          </button>
        </div>

      </div>
    </div>
  );
}
