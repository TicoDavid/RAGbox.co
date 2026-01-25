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
  ComponentVariation,
  SystemAuditEvent,
  ForgeContext,
  InsightHandoffPayload
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
import CreateVaultModal from './components/CreateVaultModal';
import SideDrawer from './components/SideDrawer';
import { ThinkingIcon, HistoryIcon } from './components/Icons';

// Vault contents storage (in-memory for demo)
const VAULT_CONTENTS: Record<string, string> = {};

// Get initial chat log (empty - no intro message per user request)
const getInitialChatLog = (): ChatMessage[] => {
  return [];
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
  const [chatLog, setChatLog] = useState<ChatMessage[]>(() => getInitialChatLog());

  // System Audit Events (separate from chat)
  const [auditEvents, setAuditEvents] = useState<SystemAuditEvent[]>([]);

  // Forge context for insight-to-artifact workflow
  const [forgeContext, setForgeContext] = useState<ForgeContext>({
    state: 'idle',
    incomingPayload: null,
    animationTitle: '',
    progress: 0
  });

  // Helper to add audit event
  const addAuditEvent = useCallback((category: SystemAuditEvent['category'], message: string) => {
    const event: SystemAuditEvent = {
      id: generateId(),
      timestamp: Date.now(),
      category,
      message
    };
    setAuditEvents(prev => [...prev, event]);
  }, []);

  // Session & Archive state
  const [archivedSessions, setArchivedSessions] = useState<Session[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isCreateVaultModalOpen, setIsCreateVaultModalOpen] = useState(false);

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

  // File drop handler - supports multiple files
  const handleFileDrop = async (files: File[]) => {
    const newSources: Source[] = [];
    const fileNames: string[] = [];
    let hasImage = false;

    // Process each file
    for (const file of files) {
      const { typeDescription, isImage } = getFileTypeDescription(file);

      let content = '';
      let base64: string | undefined = undefined;

      if (isImage) {
        hasImage = true;
        try {
          base64 = await fileToBase64(file);
          content = `[Image Asset: ${file.name}]`;
        } catch (e) {
          console.error("Failed to read image", e);
          continue;
        }
      } else {
        content = `[Document: ${file.name}]
- Status: Uploaded via Security Drop.
- Analysis: Contains verified data regarding user inquiry.
- Key Metric: 98% compliance with internal standards.
- Note: This is a simulated ingestion for the demo.`;
      }

      const newSource: Source = {
        id: Date.now() + Math.random(),
        title: file.name,
        type: isImage ? 'image' : 'text',
        time: "Just now",
        isNew: true,
        content: content,
        base64: base64,
        mimeType: file.type
      };

      newSources.push(newSource);
      fileNames.push(file.name);
    }

    if (newSources.length === 0) return;

    setTimeout(() => {
      setSources(prev => [...newSources, ...prev]);

      // Add to audit log instead of chat
      const fileListStr = fileNames.length <= 3
        ? fileNames.map(n => `"${n}"`).join(', ')
        : `"${fileNames[0]}", "${fileNames[1]}", ... (+${fileNames.length - 2} more)`;

      addAuditEvent(
        'INGEST',
        `${files.length} source${files.length !== 1 ? 's' : ''} ingested. (${fileListStr})`
      );

      if (hasImage) setStudioMode('VISION');
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
    setChatLog(getInitialChatLog());
    setArtifacts([]);
  };

  const handleDeleteSession = () => {
    setChatLog(getInitialChatLog());
    setArtifacts([]);
  };

  const handleCreateVault = () => {
    setIsCreateVaultModalOpen(true);
  };

  const handleCreateVaultSubmit = (name: string) => {
    const newVault: Vault = {
      id: generateId(),
      name: name,
      status: 'open',
      tenantId: session?.user?.id || 'default',
      documentCount: 0,
      storageUsedBytes: 0,
      createdAt: new Date()
    };
    setVaults(prev => [...prev, newVault]);
    addAuditEvent('VAULT', `New Secure Vault Initialized: "${name}" - Status: OPEN`);
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
    addAuditEvent('TRANSFER', `Secure Transfer: ${sourcesToMove.length} item(s) moved to "${targetVault.name}"`);
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

    addAuditEvent('VAULT', `Session encrypted and transferred to vault: "${vaultName}"`);
    setChatLog([]);
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

  // Handle artifact deletion
  const handleDeleteArtifact = useCallback((artifactId: string) => {
    setArtifacts(prev => prev.filter(a => a.id !== artifactId));
    // Add audit event for artifact deletion
    addAuditEvent('forge', `Artifact ${artifactId} securely removed from Forge`);
  }, [addAuditEvent]);

  // Handle insight action from Mercury chat - orchestrates the insight-to-artifact workflow
  const handleInsightAction = useCallback((payload: InsightHandoffPayload) => {
    // Set initial state - receiving intel
    setForgeContext({
      state: 'receiving_intel',
      incomingPayload: payload,
      animationTitle: payload.context_data.title,
      progress: 0
    });

    // Add audit event
    addAuditEvent('SYSTEM', `Insight handoff initiated: "${payload.context_data.title}" -> ${payload.artifact_type.toUpperCase()} artifact`);

    // After 500ms: Set to forging state
    setTimeout(() => {
      setForgeContext(prev => ({
        ...prev,
        state: 'forging',
        progress: 10
      }));
    }, 500);

    // Animate progress from 10 to 100 over 2 seconds
    const progressInterval = setInterval(() => {
      setForgeContext(prev => {
        if (prev.progress >= 100) {
          clearInterval(progressInterval);
          return prev;
        }
        return {
          ...prev,
          progress: Math.min(prev.progress + 5, 100)
        };
      });
    }, 100);

    // At 2.5s: Create the artifact
    setTimeout(() => {
      clearInterval(progressInterval);

      // Generate artifact content based on type
      const artifactContent = generateArtifactFromInsight(payload);

      const newArtifact: Artifact = {
        id: generateId(),
        type: payload.artifact_type,
        styleName: `Generated ${payload.artifact_type.toUpperCase()}`,
        title: payload.context_data.title,
        content: artifactContent,
        status: 'complete',
        sourceInsightId: payload.source_insight_id,
        handoffPayload: payload
      };

      setArtifacts(prev => [newArtifact, ...prev]);

      // Set forge state to complete
      setForgeContext(prev => ({
        ...prev,
        state: 'complete',
        progress: 100
      }));

      // Add audit event
      addAuditEvent('SYSTEM', `Artifact forged from insight: "${payload.context_data.title}" (${payload.artifact_type})`);

      // Reset to idle after 1 second
      setTimeout(() => {
        setForgeContext({
          state: 'idle',
          incomingPayload: null,
          animationTitle: '',
          progress: 0
        });
      }, 1000);
    }, 2500);
  }, [addAuditEvent]);

  // Generate artifact content from insight payload
  const generateArtifactFromInsight = (payload: InsightHandoffPayload): string => {
    const { artifact_type, context_data } = payload;
    const { title, summary_text, key_datapoints, insight_type } = context_data;

    switch (artifact_type) {
      case 'chart':
        return `
<div style="padding: 24px; background: linear-gradient(135deg, #0a0a0f 0%, #131316 100%); border-radius: 12px; font-family: system-ui; color: white; border: 1px solid rgba(0,0,255,0.2);">
  <h2 style="margin: 0 0 16px 0; font-size: 1.2rem; color: #0000FF; text-transform: uppercase; letter-spacing: 0.1em;">${title}</h2>
  <div style="background: rgba(0,0,255,0.05); padding: 16px; border-radius: 8px; border: 1px solid rgba(0,0,255,0.1);">
    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
      ${key_datapoints ? Object.entries(key_datapoints).map(([k, v]) => `
        <div style="text-align: center;">
          <div style="font-size: 1.5rem; color: #0000FF; font-weight: bold;">${v}</div>
          <div style="font-size: 0.75rem; color: #888; text-transform: uppercase;">${k}</div>
        </div>
      `).join('') : ''}
    </div>
    <div style="height: 120px; background: linear-gradient(to right, rgba(0,0,255,0.1), rgba(0,0,255,0.3)); border-radius: 4px; position: relative;">
      <div style="position: absolute; bottom: 0; left: 10%; width: 15%; height: 60%; background: #0000FF; border-radius: 4px 4px 0 0;"></div>
      <div style="position: absolute; bottom: 0; left: 30%; width: 15%; height: 80%; background: #0000FF; border-radius: 4px 4px 0 0;"></div>
      <div style="position: absolute; bottom: 0; left: 50%; width: 15%; height: 45%; background: #0000FF; border-radius: 4px 4px 0 0;"></div>
      <div style="position: absolute; bottom: 0; left: 70%; width: 15%; height: 95%; background: #0000FF; border-radius: 4px 4px 0 0;"></div>
    </div>
  </div>
  <p style="margin: 16px 0 0 0; font-size: 0.85rem; color: #888; line-height: 1.5;">${summary_text.substring(0, 150)}${summary_text.length > 150 ? '...' : ''}</p>
</div>`;

      case 'ui':
        if (insight_type === 'risk_assessment') {
          return `
<div style="padding: 24px; background: linear-gradient(135deg, #0a0a0f 0%, #1a0a0a 100%); border-radius: 12px; font-family: system-ui; color: white; border: 1px solid rgba(255,61,0,0.3);">
  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
    <div style="width: 40px; height: 40px; background: rgba(255,61,0,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF3D00" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    </div>
    <h2 style="margin: 0; font-size: 1.1rem; color: #FF3D00; text-transform: uppercase; letter-spacing: 0.1em;">Risk Alert</h2>
  </div>
  <h3 style="margin: 0 0 12px 0; font-size: 1rem; color: white;">${title}</h3>
  <p style="margin: 0 0 16px 0; font-size: 0.9rem; color: #ccc; line-height: 1.6;">${summary_text}</p>
  <div style="display: flex; gap: 12px;">
    <button style="flex: 1; padding: 12px; background: rgba(255,61,0,0.1); border: 1px solid rgba(255,61,0,0.3); border-radius: 6px; color: #FF3D00; font-weight: 600; cursor: pointer;">Review Now</button>
    <button style="flex: 1; padding: 12px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #888; cursor: pointer;">Dismiss</button>
  </div>
</div>`;
        }
        return `
<div style="padding: 24px; background: linear-gradient(135deg, #0a0a0f 0%, #131316 100%); border-radius: 12px; font-family: system-ui; color: white; border: 1px solid rgba(0,0,255,0.2);">
  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
    <div style="width: 40px; height: 40px; background: rgba(0,0,255,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0000FF" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
    </div>
    <h2 style="margin: 0; font-size: 1.1rem; color: #0000FF; text-transform: uppercase; letter-spacing: 0.1em;">${insight_type === 'recommendation' ? 'Recommendation' : 'Insight'}</h2>
  </div>
  <h3 style="margin: 0 0 12px 0; font-size: 1rem; color: white;">${title}</h3>
  <p style="margin: 0 0 16px 0; font-size: 0.9rem; color: #ccc; line-height: 1.6;">${summary_text}</p>
  ${key_datapoints ? `
  <div style="display: flex; gap: 16px; flex-wrap: wrap;">
    ${Object.entries(key_datapoints).map(([k, v]) => `
      <div style="background: rgba(0,0,255,0.05); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(0,0,255,0.1);">
        <div style="font-size: 0.7rem; color: #888; text-transform: uppercase;">${k}</div>
        <div style="font-size: 0.9rem; color: #0000FF; font-weight: 600;">${v}</div>
      </div>
    `).join('')}
  </div>` : ''}
</div>`;

      default:
        return `
<div style="padding: 24px; background: linear-gradient(135deg, #131316 0%, #1a1a1f 100%); border-radius: 12px; font-family: system-ui; color: white; border: 1px solid rgba(0,0,255,0.2);">
  <h2 style="margin: 0 0 16px 0; font-size: 1.2rem; color: #0000FF;">${title}</h2>
  <p style="margin: 0; font-size: 0.95rem; color: #ccc; line-height: 1.6;">${summary_text}</p>
</div>`;
    }
  };

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
            const vaultName = vaults.find(v => v.id === editingVaultId)?.name;
            setVaults(prev => prev.map(v => v.id === editingVaultId ? { ...v, status: newStatus } : v));
            addAuditEvent('SECURITY', `Vault "${vaultName}" status changed to ${newStatus.toUpperCase()}`);
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

      {/* Create Vault Modal */}
      <CreateVaultModal
        isOpen={isCreateVaultModalOpen}
        onClose={() => setIsCreateVaultModalOpen(false)}
        onCreate={handleCreateVaultSubmit}
      />

      {/* Main App */}
      <div className="ragbox-app">
        <Header
          theme={currentTheme}
          toggleTheme={toggleTheme}
          searchTerm={globalSearchTerm}
          onSearchChange={setGlobalSearchTerm}
          userImage={session?.user?.image}
          userName={session?.user?.name}
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
            auditEvents={auditEvents}
            onInputChange={setInputValue}
            onSendMessage={handleSendMessage}
            onNewSession={handleNewSession}
            onShowHistory={() => setDrawerState({ isOpen: true, mode: 'history', title: 'Session Archives', data: null })}
            onSaveToVault={() => setIsSaveModalOpen(true)}
            onDeleteSession={handleDeleteSession}
            onInsightAction={handleInsightAction}
          />
          <div className="resizer" onMouseDown={() => handleMouseDown(2)}></div>

          {/* Column 3: Studio */}
          <StudioPanel
            artifacts={artifacts}
            studioMode={studioMode}
            gridColumns={gridColumns}
            focusedArtifactIndex={focusedArtifactIndex}
            isLoading={isLoading}
            forgeContext={forgeContext}
            onStudioModeChange={setStudioMode}
            onGridColumnsChange={setGridColumns}
            onArtifactClick={setFocusedArtifactIndex}
            onGenerateVariations={handleGenerateVariations}
            onShowCode={(content) => setDrawerState({ isOpen: true, mode: 'code', title: 'Source Code', data: content })}
            onSendDesignPrompt={(prompt) => handleSendMessage('design', prompt)}
            onDeleteArtifact={handleDeleteArtifact}
          />
        </div>
      </div>
    </div>
  );
}
