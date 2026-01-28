"use client";

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

// Import Components
import MercuryConsole from '@/components/MercuryConsole';
import EvidenceLocker from '@/components/EvidenceLocker';
import VerificationPanel, { Citation } from '@/components/VerificationPanel';

export default function Dashboard() {
  const { data: session, status } = useSession();

  // -- GLOBAL STATE --
  const [privilegeMode, setPrivilegeMode] = useState(false);

  // -- VERIFICATION STATE --
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  // -- EVIDENCE STATE --
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [evidenceFiles] = useState([
    { id: '1', name: 'Witness_Testimony_v2_REDACTED.pdf', type: 'pdf' as const, status: 'ready' as const, size: '2.4 MB', timestamp: '10:42 AM' },
    { id: '2', name: 'Q3_Financial_Ledger.xlsx', type: 'xlsx' as const, status: 'ready' as const, size: '840 KB', timestamp: '10:45 AM' },
    { id: '3', name: 'Surveillance_Log_01.txt', type: 'txt' as const, status: 'ready' as const, size: '12 KB', timestamp: '11:00 AM' },
    { id: '4', name: 'New_Discovery_Dump.zip', type: 'pdf' as const, status: 'indexing' as const, size: '145 MB', timestamp: '11:05 AM' },
  ]);

  if (status === 'unauthenticated') redirect('/');

  return (
    <div className={`flex flex-col h-screen bg-oled text-gray-200 overflow-hidden font-sans selection:bg-cyan selection:text-black ${privilegeMode ? 'theme-privilege' : ''}`}>

      {/* 1. GLOBAL HEADER */}
      <header className="h-14 border-b border-border bg-carbon/50 flex items-center justify-between px-4 shrink-0 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyan rounded-sm flex items-center justify-center font-bold text-black font-header tracking-tighter">
            RB
          </div>
          <span className="font-header font-bold tracking-widest text-lg text-white">
            RAGBÖX <span className="text-xs text-gray-500 font-mono font-normal opacity-50">SOVEREIGN_OS v2.0</span>
          </span>
        </div>

        <div className="flex items-center gap-6">
           {/* Privilege Toggle */}
           <button
             onClick={() => setPrivilegeMode(!privilegeMode)}
             className={`
               relative flex items-center gap-3 px-4 py-1.5 rounded-sm border transition-all duration-300
               ${privilegeMode
                 ? 'border-privilege bg-privilege/10 shadow-red-pulse'
                 : 'border-border bg-transparent hover:border-gray-600'}
             `}
           >
             <div className={`w-2 h-2 rounded-full ${privilegeMode ? 'bg-privilege animate-pulse' : 'bg-gray-600'}`} />
             <span className={`font-mono text-xs uppercase tracking-wider ${privilegeMode ? 'text-privilege font-bold' : 'text-gray-400'}`}>
               {privilegeMode ? 'PRIVILEGE ACTIVE' : 'OPEN MODE'}
             </span>
           </button>

           <div className="w-8 h-8 rounded-full bg-steel border border-border flex items-center justify-center text-xs font-mono">
             {session?.user?.name?.[0] || 'U'}
           </div>
        </div>
      </header>


      {/* 2. THE SOVEREIGN GRID */}
      <div className="flex-1 grid grid-cols-[280px_1fr_360px] divide-x divide-border overflow-hidden">

        {/* --- PANE A: EVIDENCE LOCKER (New Component) --- */}
        <EvidenceLocker
          files={evidenceFiles}
          selectedId={selectedDocId}
          onSelect={setSelectedDocId}
          onUpload={() => alert('Connect Ingestion Pipeline')}
        />

        {/* --- PANE B: INTERROGATION --- */}
        <main className="bg-oled flex flex-col relative min-w-0">
           <MercuryConsole
             privilegeMode={privilegeMode}
             onCitationClick={setActiveCitation}
           />
        </main>


        {/* --- PANE C: VERIFICATION --- */}
        <VerificationPanel
          citation={activeCitation}
          onClear={() => setActiveCitation(null)}
          onViewDocument={(docId) => setSelectedDocId(docId)}
        />

      </div>

      {/* Global Privilege Overlay */}
      {privilegeMode && (
        <div className="pointer-events-none fixed inset-0 border-[2px] border-privilege/50 z-[100] animate-pulse" />
      )}
    </div>
  );
}
