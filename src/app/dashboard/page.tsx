"use client";

import React, { useState, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

// Import styles
import './dashboard.css';

// Import types
import type {
  Vault,
  Source,
  Artifact,
  Session,
  ChatMessage,
  DrawerState,
  StudioMode,
  ComponentVariation
} from './types';

// Import utilities
import { generateId, fileToBase64, getFileTypeDescription } from './utils';
import { MOCK_RESPONSES } from './constants';

// Import components
import Header from './components/Header';
import VaultPanel from './components/VaultPanel';
import SecurityDrop from './components/SecurityDrop';
import MercuryChat from './components/MercuryChat';
import StudioPanel from './components/StudioPanel';
import SecurityModal from './components/SecurityModal';
import SaveToVaultModal from './components/SaveToVaultModal';
import SideDrawer from './components/SideDrawer';
import { ThinkingIcon, HistoryIcon } from './components/Icons';

// Vault contents storage (in-memory for demo)
const VAULT_CONTENTS: Record<string, string> = {};

// Get initial chat log
const getInitialChatLog = (vaults: Vault[], sources: Source[]): ChatMessage[] => {
  const openVaults = vaults.filter(v => v.status === 'open');
  const hasSources = sources.length > 0;

  let text = "MERCURY\n\nSUMMARY\n• Secure Core Online.\n";

  if (openVaults.length === 0 && !hasSources) {
    text += "• No active vault context detected.";
  } else {
    text += "• Active context verified and ready for analysis.";
  }

  return [{ id: 'intro', text, isUser: false, timestamp: Date.now() }];
};

export default function Dashboard() {
  // Auth check
  const { data: session, status } = useSession();

  // Theme
  const { theme, setTheme, resolvedTheme } = useTheme();
  const currentTheme = (resolvedTheme || theme || 'dark') as 'dark' | 'light';

  // Global search
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');

  // Input state
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Vault state
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [editingVaultId, setEditingVaultId] = useState<string | null>(null);

  // Sources state
  const [sources, setSources] = useState<Source[]>([]);

  // Layout state (resizable panels)
  const [colWidths, setColWidths] = useState([280, 280, 450]);
  const isResizing = useRef<number | null>(null);

  // Studio state
  const [gridColumns, setGridColumns] = useState<1 | 2 | 4>(2);
  const [studioMode, setStudioMode] = useState<StudioMode>('UI');
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);

  // Chat state
  const [chatLog, setChatLog] = useState<ChatMessage[]>(() => getInitialChatLog([], []));

  // Session & Archive state
  const [archivedSessions, setArchivedSessions] = useState<Session[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // Drawer state
  const [drawerState, setDrawerState] = useState<DrawerState>({
    isOpen: false,
    mode: null,
    title: '',
    data: null
  });
  const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);

  // Redirect if not authenticated
  if (status === 'unauthenticated') {
    redirect('/');
  }

  // Resizing logic
  const handleMouseDown = (index: number) => {
    isResizing.current = index;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing.current === null) return;
    const index = isResizing.current;

    setColWidths(prev => {
      const newWidths = [...prev];
      if (e.movementX) {
        newWidths[index] = Math.max(150, newWidths[index] + e.movementX);
      }
      return newWidths;
    });
  }, []);

  const handleMouseUp = () => {
    isResizing.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
  };

  const toggleTheme = () => {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  };

  // File drop handler
  const handleFileDrop = async (file: File) => {
    const { typeDescription, isImage } = getFileTypeDescription(file);

    let content = '';
    let base64: string | undefined = undefined;

    if (isImage) {
      try {
        base64 = await fileToBase64(file);
        content = `[Image Asset: ${file.name}]`;
      } catch (e) {
        console.error("Failed to read image", e);
        return;
      }
    } else {
      content = `[Document: ${file.name}]
- Status: Uploaded via Security Drop.
- Analysis: Contains verified data regarding user inquiry.
- Key Metric: 98% compliance with internal standards.
- Note: This is a simulated ingestion for the demo.`;
    }

    const newSource: Source = {
      id: Date.now(),
      title: file.name,
      type: isImage ? 'image' : 'text',
      time: "Just now",
      isNew: true,
      content: content,
      base64: base64,
      mimeType: file.type
    };

    setTimeout(() => {
      setSources(prev => [newSource, ...prev]);
      setChatLog(prev => [...prev, {
        id: generateId(),
        text: `MERCURY\n\nFINDINGS\n• New Source Ingested: "${file.name}"\n• Type: ${typeDescription}`,
        isUser: false,
        timestamp: Date.now()
      }]);

      if (isImage) setStudioMode('VISION');
    }, 800);
  };

  // Send message handler (mock responses)
  const handleSendMessage = useCallback(async (mode: 'chat' | 'design' = 'chat', overridePrompt?: string) => {
    const textToUse = overridePrompt || inputValue.trim();
    if (!textToUse || isLoading) return;

    if (!overridePrompt) setInputValue('');
    setIsLoading(true);

    // Add user message
    const userMsgId = generateId();
    setChatLog(prev => [...prev, { id: userMsgId, text: textToUse, isUser: true, timestamp: Date.now() }]);

    // Check context
    const openVaults = vaults.filter(v => v.status === 'open');
    const hasContext = openVaults.length > 0 || sources.length > 0;

    // Simulate AI response delay
    setTimeout(() => {
      const botMsgId = generateId();
      const responseText = hasContext ? MOCK_RESPONSES.default : MOCK_RESPONSES.noContext;

      setChatLog(prev => [...prev, {
        id: botMsgId,
        text: responseText,
        isUser: false,
        timestamp: Date.now()
      }]);

      // If design mode, create mock artifact
      if (mode === 'design') {
        const newArtifact: Artifact = {
          id: generateId(),
          type: studioMode === 'ASSET' ? 'image' : studioMode === 'VIDEO' ? 'video' : studioMode === 'CHART' ? 'chart' : 'ui',
          styleName: `Generated ${studioMode}`,
          title: textToUse,
          content: `<div style="padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-family: system-ui; border-radius: 12px; text-align: center;">
            <h2 style="margin: 0 0 10px 0;">${textToUse}</h2>
            <p style="margin: 0; opacity: 0.8;">Generated UI Component</p>
          </div>`,
          status: 'complete'
        };

        setArtifacts(prev => [newArtifact, ...prev]);
      }

      setIsLoading(false);
    }, 1500);
  }, [inputValue, isLoading, vaults, sources, studioMode]);

  // Session actions
  const handleNewSession = () => {
    if (chatLog.length > 1 || artifacts.length > 0) {
      const sessionTitle = chatLog.find(m => m.isUser)?.text || `Session ${new Date().toLocaleTimeString()}`;
      const newSession: Session = {
        id: generateId(),
        prompt: sessionTitle,
        timestamp: Date.now(),
        artifacts: [...artifacts]
      };
      setArchivedSessions(prev => [newSession, ...prev]);
    }
    setChatLog(getInitialChatLog(vaults, sources));
    setArtifacts([]);
  };

  const handleDeleteSession = () => {
    setChatLog(getInitialChatLog(vaults, sources));
    setArtifacts([]);
  };

  const handleCreateVault = () => {
    const name = prompt("Enter Vault Name:");
    if (name) {
      const newVault: Vault = {
        id: generateId(),
        name: name,
        status: 'open'
      };
      setVaults(prev => [...prev, newVault]);
      setChatLog(prev => [...prev, {
        id: generateId(),
        text: `MERCURY\n\nFINDINGS\n• New Secure Vault Initialized: "${name}"\n• Status: OPEN (Ready for ingress)`,
        isUser: false,
        timestamp: Date.now()
      }]);
    }
  };

  const handleMoveSourceToVault = (vaultId: string, sourceIds: number[]) => {
    const targetVault = vaults.find(v => v.id === vaultId);
    if (!targetVault) return;

    const sourcesToMove = sources.filter(s => sourceIds.includes(s.id));
    if (sourcesToMove.length === 0) return;

    let appendContent = "";
    sourcesToMove.forEach(s => {
      appendContent += `\n[Moved Source: ${s.title}]\n${s.content || '(Binary Data)'}`;
    });

    if (VAULT_CONTENTS[vaultId]) {
      VAULT_CONTENTS[vaultId] += appendContent;
    } else {
      VAULT_CONTENTS[vaultId] = appendContent;
    }

    setSources(prev => prev.filter(s => !sourceIds.includes(s.id)));

    setChatLog(prev => [...prev, {
      id: generateId(),
      text: `MERCURY\n\nFINDINGS\n• Secure Transfer: ${sourcesToMove.length} item(s) moved to "${targetVault.name}".\n• Security Drop cleared.`,
      isUser: false,
      timestamp: Date.now()
    }]);
  };

  const handleSaveToVault = (vaultId: string) => {
    const vaultName = vaults.find(v => v.id === vaultId)?.name;
    const sessionData = chatLog.map(c => `${c.isUser ? 'USER' : 'MERCURY'}: ${c.text}`).join('\n');
    const artifactData = artifacts.map(a => `[Artifact: ${a.styleName}]`).join('\n');

    if (VAULT_CONTENTS[vaultId]) {
      VAULT_CONTENTS[vaultId] += `\n\n[SAVED SESSION - ${new Date().toLocaleDateString()}]\n${sessionData}\n${artifactData}`;
    }

    const sessionTitle = chatLog.find(m => m.isUser)?.text || `Saved Session`;
    const newSession: Session = {
      id: generateId(),
      prompt: `SAVED: ${sessionTitle}`,
      timestamp: Date.now(),
      artifacts: [...artifacts]
    };
    setArchivedSessions(prev => [newSession, ...prev]);

    setChatLog([{
      id: generateId(),
      text: `MERCURY\n\nSUMMARY\n• Session successfully encrypted and transferred to vault: "${vaultName}".\n• Workspace cleared for new tasks.`,
      isUser: false,
      timestamp: Date.now()
    }]);
    setArtifacts([]);
  };

  const handleGenerateVariations = useCallback(async (artifactId: string) => {
    // Mock variation generation
    setComponentVariations([]);
    setDrawerState({ isOpen: true, mode: 'variations', title: 'Variations', data: artifactId });

    setTimeout(() => {
      setComponentVariations([
        { name: 'Minimal', html: '<div style="padding:20px;background:#111;color:#fff;border-radius:8px;">Minimal Variant</div>' },
        { name: 'Vibrant', html: '<div style="padding:20px;background:linear-gradient(45deg,#ff6b6b,#feca57);color:#fff;border-radius:8px;">Vibrant Variant</div>' },
        { name: 'Corporate', html: '<div style="padding:20px;background:#1a365d;color:#fff;border-radius:8px;">Corporate Variant</div>' }
      ]);
    }, 1000);
  }, []);

  // Filtering logic
  const filteredVaults = vaults.filter(v => v.name.toLowerCase().includes(globalSearchTerm.toLowerCase()));
  const filteredSources = sources.filter(s => s.title.toLowerCase().includes(globalSearchTerm.toLowerCase()));

  // Loading state for auth
  if (status === 'loading') {
    return (
      <div className="dashboard-root" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <ThinkingIcon />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`dashboard-root ${currentTheme}`} style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Drawer */}
      <SideDrawer
        isOpen={drawerState.isOpen}
        onClose={() => setDrawerState(s => ({ ...s, isOpen: false }))}
        title={drawerState.title}
      >
        {drawerState.mode === 'code' && (
          <pre className="code-block"><code>{drawerState.data as string}</code></pre>
        )}

        {drawerState.mode === 'variations' && (
          <div className="sexy-grid">
            {componentVariations.map((v, i) => (
              <div key={i} className="sexy-card" onClick={() => setDrawerState(s => ({ ...s, isOpen: false }))}>
                <div className="sexy-preview">
                  <iframe srcDoc={v.html} title={v.name} sandbox="allow-scripts allow-same-origin" />
                </div>
                <div className="sexy-label">{v.name}</div>
              </div>
            ))}
            {componentVariations.length === 0 && (
              <div className="loading-state"><ThinkingIcon /> Designing...</div>
            )}
          </div>
        )}

        {drawerState.mode === 'history' && (
          <div className="sources-list">
            {archivedSessions.length === 0 && (
              <div style={{ padding: 20, color: '#666' }}>No archived sessions.</div>
            )}
            {archivedSessions.map(sessionItem => (
              <div key={sessionItem.id} className="source-card-new">
                <div className="source-card-icon"><HistoryIcon /></div>
                <div className="source-card-details">
                  <div className="source-card-title">{sessionItem.prompt}</div>
                  <div className="source-card-time">{new Date(sessionItem.timestamp).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SideDrawer>

      {/* Security Modal */}
      <SecurityModal
        isOpen={!!editingVaultId}
        onClose={() => setEditingVaultId(null)}
        vaultName={vaults.find(v => v.id === editingVaultId)?.name || 'Unknown Vault'}
        currentStatus={vaults.find(v => v.id === editingVaultId)?.status || 'closed'}
        onUpdateStatus={(newStatus) => {
          if (editingVaultId) {
            setVaults(prev => prev.map(v => v.id === editingVaultId ? { ...v, status: newStatus } : v));
            if (newStatus === 'open') {
              setChatLog(prev => [...prev, {
                id: generateId(),
                text: `MERCURY\n\nFindings\n• Vault "${vaults.find(v => v.id === editingVaultId)?.name}" access granted.\n• Context updated.`,
                isUser: false,
                timestamp: Date.now()
              }]);
            }
          }
        }}
      />

      {/* Save to Vault Modal */}
      <SaveToVaultModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        vaults={vaults}
        onSave={handleSaveToVault}
      />

      {/* Main App */}
      <div className="ragbox-app">
        <Header
          theme={currentTheme}
          toggleTheme={toggleTheme}
          searchTerm={globalSearchTerm}
          onSearchChange={setGlobalSearchTerm}
        />

        {/* Dynamic Resizable Layout */}
        <div
          className="ragbox-layout"
          style={{
            gridTemplateColumns: `${colWidths[0]}px 16px ${colWidths[1]}px 16px ${colWidths[2]}px 16px 1fr`
          }}
        >
          {/* Column 0: Vault */}
          <VaultPanel
            vaults={filteredVaults}
            onVaultClick={setEditingVaultId}
            onSourceDrop={handleMoveSourceToVault}
            onCreateVault={handleCreateVault}
          />
          <div className="resizer" onMouseDown={() => handleMouseDown(0)}></div>

          {/* Column 1: Security Drop */}
          <SecurityDrop
            sources={filteredSources}
            onFileDrop={handleFileDrop}
          />
          <div className="resizer" onMouseDown={() => handleMouseDown(1)}></div>

          {/* Column 2: Mercury Chat */}
          <MercuryChat
            chatLog={chatLog}
            inputValue={inputValue}
            isLoading={isLoading}
            vaults={filteredVaults}
            sources={filteredSources}
            onInputChange={setInputValue}
            onSendMessage={handleSendMessage}
            onNewSession={handleNewSession}
            onShowHistory={() => setDrawerState({ isOpen: true, mode: 'history', title: 'Session Archives', data: null })}
            onSaveToVault={() => setIsSaveModalOpen(true)}
            onDeleteSession={handleDeleteSession}
          />
          <div className="resizer" onMouseDown={() => handleMouseDown(2)}></div>

          {/* Column 3: Studio */}
          <StudioPanel
            artifacts={artifacts}
            studioMode={studioMode}
            gridColumns={gridColumns}
            focusedArtifactIndex={focusedArtifactIndex}
            isLoading={isLoading}
            onStudioModeChange={setStudioMode}
            onGridColumnsChange={setGridColumns}
            onArtifactClick={setFocusedArtifactIndex}
            onGenerateVariations={handleGenerateVariations}
            onShowCode={(content) => setDrawerState({ isOpen: true, mode: 'code', title: 'Source Code', data: content })}
            onSendDesignPrompt={(prompt) => handleSendMessage('design', prompt)}
          />
        </div>
      </div>
    </div>
  );
}
