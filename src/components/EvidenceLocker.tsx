import React from 'react';
import { FileText, Plus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface EvidenceFile {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'xlsx' | 'txt';
  status: 'indexing' | 'ready' | 'error';
  size: string;
  timestamp: string;
}

interface EvidenceLockerProps {
  files: EvidenceFile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpload: () => void;
}

export default function EvidenceLocker({ files, selectedId, onSelect, onUpload }: EvidenceLockerProps) {

  const getIcon = (_type: string) => {
    // We can expand icons later, default to FileText for now
    return <FileText className="w-4 h-4" />;
  };

  return (
    <div className="flex flex-col h-full bg-oled border-r border-border min-w-0">

      {/* 1. Header & Stats */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-carbon/30 shrink-0">
        <div className="flex items-center gap-2">
           <span className="font-header text-sm font-bold tracking-wider text-gray-200 uppercase">VAULT: PRIVATE</span>
        </div>
        <span className="font-mono text-[10px] text-cyan bg-cyan/10 px-1.5 py-0.5 rounded">
          {files.length} DOCS
        </span>
      </div>

      {/* 2. Scrollable File List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-800">

        {files.length === 0 && (
          <div className="h-32 flex flex-col items-center justify-center text-gray-600 font-mono text-xs opacity-50">
             // EMPTY VAULT
          </div>
        )}

        {files.map((file) => {
          const isSelected = selectedId === file.id;
          return (
            <div
              key={file.id}
              onClick={() => onSelect(file.id)}
              className={`
                group flex items-center gap-3 p-3 rounded-sm cursor-pointer border transition-all duration-200
                ${isSelected
                  ? 'bg-cyan/5 border-cyan/30 shadow-[inset_2px_0_0_0_#00F0FF]'
                  : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'}
              `}
            >
              {/* Icon & Status */}
              <div className={`shrink-0 ${isSelected ? 'text-cyan' : 'text-gray-500 group-hover:text-gray-300'}`}>
                {file.status === 'indexing' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                ) : (
                  getIcon(file.type)
                )}
              </div>

              {/* Metadata */}
              <div className="flex-1 min-w-0 flex flex-col">
                 <span className={`font-sans text-xs truncate ${isSelected ? 'text-white font-medium' : 'text-gray-400 group-hover:text-gray-200'}`}>
                   {file.name}
                 </span>
                 <div className="flex items-center gap-2 mt-0.5">
                   <span className="font-mono text-[9px] text-gray-600 uppercase">{file.type} • {file.size}</span>
                 </div>
              </div>

              {/* Status Indicator */}
              <div className="shrink-0">
                 {file.status === 'ready' && <CheckCircle2 className="w-3 h-3 text-emerald-500/50" />}
                 {file.status === 'error' && <AlertCircle className="w-3 h-3 text-privilege" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Upload Action (Footer) */}
      <div className="p-4 border-t border-border bg-carbon/10">
        <button
          onClick={onUpload}
          className="w-full flex items-center justify-center gap-2 p-3 rounded border border-dashed border-gray-700 hover:border-cyan hover:bg-cyan/5 transition-all group"
        >
          <Plus className="w-4 h-4 text-gray-500 group-hover:text-cyan" />
          <span className="font-mono text-xs text-gray-500 group-hover:text-cyan tracking-wider">MOUNT EVIDENCE</span>
        </button>
      </div>
    </div>
  );
}
