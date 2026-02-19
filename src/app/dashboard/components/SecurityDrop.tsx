"use client";

import React, { useState, useCallback, useRef } from 'react';
import type { Source } from '../types';
import { MenuIcon } from './Icons';
import IngestionVortex from './IngestionVortex';
import FolderTree, { type FolderItem } from '@/components/dropzone/FolderTree';
import QuickAccess from '@/components/dropzone/QuickAccess';
import StorageIndicator from '@/components/dropzone/StorageIndicator';
import ContentArea from '@/components/dropzone/ContentArea';
import FileHoverModal from '@/components/dropzone/FileHoverModal';
import TierPromotionDialog from '@/components/ui/TierPromotionDialog';

interface SecurityDropProps {
  sources: Source[];
  onFileDrop: (files: File[]) => void;
  theme?: 'dark' | 'light';
  onSourceDelete?: (id: number) => void;
  onTierChange?: (sourceId: number, newTier: number) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  sourceId: number | null;
}

// Map Source to DocumentItem format expected by ContentArea
function sourceToDocumentItem(source: Source) {
  return {
    id: String(source.id),
    name: source.title,
    size: source.content?.length || 0,
    type: source.mimeType?.split('/').pop() || (source.type === 'image' ? 'png' : 'txt'),
    uploadedAt: source.time === 'Just now' ? new Date().toISOString() : source.time,
    status: source.isNew ? 'processing' : 'ready',
    securityTier: source.securityTier ?? 0,
    isPrivileged: (source.securityTier ?? 0) >= 4,
  };
}

const SecurityDrop: React.FC<SecurityDropProps> = ({
  sources,
  onFileDrop,
  onSourceDelete,
  onTierChange,
}) => {
  // View state
  const [showSidebar, setShowSidebar] = useState(true);

  // Folder state
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Quick access state
  const [quickAccessSection, setQuickAccessSection] = useState<'recent' | 'favorites' | 'shared' | null>(null);

  // Document selection
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(undefined);

  // Hover modal
  const [hoveredDoc, setHoveredDoc] = useState<{
    id: string;
    name: string;
    size: number;
    type: string;
    uploadedAt: string;
    status: string;
    securityTier: number;
    isPrivileged: boolean;
    chunkCount: number;
  } | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Context menu for tier promotion
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    sourceId: null,
  });

  // Tier promotion dialog
  const [promotionDialog, setPromotionDialog] = useState<{
    isOpen: boolean;
    sourceId: number;
    sourceName: string;
    currentTier: number;
  }>({ isOpen: false, sourceId: 0, sourceName: '', currentTier: 0 });

  // Convert sources to document items
  const documentItems = sources.map(sourceToDocumentItem);

  // Folder CRUD
  const handleCreateFolder = useCallback((name: string, parentId: string | null) => {
    const newFolder: FolderItem = {
      id: `folder-${Date.now()}`,
      name,
      parentId,
      children: [],
      documentCount: 0,
    };
    setFolders(prev => [...prev, newFolder]);
  }, []);

  const handleRenameFolder = useCallback((id: string, name: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
  }, []);

  const handleDeleteFolder = useCallback((id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    if (selectedFolderId === id) setSelectedFolderId(null);
  }, [selectedFolderId]);

  // Document selection
  const handleSelectDocument = useCallback((id: string) => {
    setSelectedDocId(id);
  }, []);

  // Document deletion
  const handleDeleteDocument = useCallback((id: string) => {
    onSourceDelete?.(Number(id));
  }, [onSourceDelete]);

  // Hover modal handlers
  const handleDocumentMouseEnter = useCallback((e: React.MouseEvent, sourceId: string) => {
    const source = sources.find(s => String(s.id) === sourceId);
    if (!source) return;

    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredDoc({
        id: sourceId,
        name: source.title,
        size: source.content?.length || 0,
        type: source.mimeType?.split('/').pop() || 'txt',
        uploadedAt: source.time === 'Just now' ? new Date().toISOString() : source.time,
        status: source.isNew ? 'processing' : 'ready',
        securityTier: source.securityTier ?? 0,
        isPrivileged: (source.securityTier ?? 0) >= 4,
        chunkCount: 0,
      });
      setHoverPos({ x: e.clientX, y: e.clientY });
    }, 400);
  }, [sources]);

  const handleDocumentMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredDoc(null);
  }, []);

  // Context menu (right-click)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const target = (e.target as HTMLElement).closest('[data-source-id]');
    if (!target) {
      setContextMenu({ visible: false, x: 0, y: 0, sourceId: null });
      return;
    }
    const sourceId = Number(target.getAttribute('data-source-id'));
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, sourceId });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, sourceId: null });
  }, []);

  const handleOpenTierDialog = useCallback(() => {
    if (contextMenu.sourceId === null) return;
    const source = sources.find(s => s.id === contextMenu.sourceId);
    if (!source) return;
    setPromotionDialog({
      isOpen: true,
      sourceId: source.id,
      sourceName: source.title,
      currentTier: source.securityTier ?? 0,
    });
    handleCloseContextMenu();
  }, [contextMenu.sourceId, sources, handleCloseContextMenu]);

  const handleTierConfirm = useCallback((targetTier: number) => {
    onTierChange?.(promotionDialog.sourceId, targetTier);
    setPromotionDialog(prev => ({ ...prev, isOpen: false }));
  }, [promotionDialog.sourceId, onTierChange]);

  // Storage calculation
  const totalStorageUsed = sources.reduce((sum, s) => sum + (s.content?.length || 0), 0);
  const maxStorage = 1024 * 1024 * 1024; // 1 GB

  return (
    <div
      className="panel sources-panel"
      onContextMenu={handleContextMenu}
      onClick={handleCloseContextMenu}
    >
      {/* Header */}
      <div className="panel-header">
        <h3 className="panel-title">The Drop Zone</h3>
        <button
          className="icon-btn"
          onClick={() => setShowSidebar(!showSidebar)}
          title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
        >
          <MenuIcon />
        </button>
      </div>

      {/* Upload Area */}
      <IngestionVortex onFileDrop={onFileDrop} />

      {/* Main Content Area */}
      <div className="sources-content" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Sidebar: Folders + Quick Access + Storage */}
        {showSidebar && (
          <div
            style={{
              width: 160,
              minWidth: 160,
              borderRight: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <FolderTree
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelectFolder={setSelectedFolderId}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
              />
              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 4 }}>
                <QuickAccess
                  recentCount={sources.filter(s => s.isNew).length}
                  favoritesCount={0}
                  sharedCount={0}
                  activeSection={quickAccessSection}
                  onSelect={setQuickAccessSection}
                />
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border-color)' }}>
              <StorageIndicator usedBytes={totalStorageUsed} maxBytes={maxStorage} />
            </div>
          </div>
        )}

        {/* Document List / Grid */}
        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          onMouseLeave={handleDocumentMouseLeave}
        >
          {sources.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
              No active sources. Drop files above.
            </div>
          ) : (
            <div
              onMouseMove={(e) => {
                // Update hover position as mouse moves over document area
                if (hoveredDoc) {
                  setHoverPos({ x: e.clientX, y: e.clientY });
                }
              }}
            >
              {documentItems.map(doc => (
                <div
                  key={doc.id}
                  data-source-id={doc.id}
                  onMouseEnter={(e) => handleDocumentMouseEnter(e, doc.id)}
                  onMouseLeave={handleDocumentMouseLeave}
                >
                  {/* Invisible wrapper for hover/context events - ContentArea renders actual items */}
                </div>
              ))}
              <ContentArea
                documents={documentItems}
                onSelectDocument={handleSelectDocument}
                onDeleteDocument={handleDeleteDocument}
                selectedDocumentId={selectedDocId}
              />
            </div>
          )}
        </div>
      </div>

      {/* Hover Modal */}
      {hoveredDoc && (
        <FileHoverModal document={hoveredDoc} position={hoverPos} />
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 rounded-lg border dark:border-[var(--bg-elevated)] border-slate-200 dark:bg-[var(--bg-secondary)] bg-white shadow-2xl py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleOpenTierDialog}
            className="w-full text-left px-4 py-2 text-xs dark:text-[var(--text-secondary)] text-slate-600 dark:hover:bg-[var(--bg-tertiary)] hover:bg-slate-100 hover:text-[var(--brand-blue)] transition-colors"
          >
            Change Security Tier
          </button>
          <button
            onClick={() => {
              if (contextMenu.sourceId !== null) handleDeleteDocument(String(contextMenu.sourceId));
              handleCloseContextMenu();
            }}
            className="w-full text-left px-4 py-2 text-xs dark:text-[var(--text-secondary)] text-slate-600 dark:hover:bg-[var(--bg-tertiary)] hover:bg-slate-100 hover:text-[var(--danger)] transition-colors"
          >
            Delete
          </button>
        </div>
      )}

      {/* Tier Promotion Dialog */}
      <TierPromotionDialog
        documentId={String(promotionDialog.sourceId)}
        documentName={promotionDialog.sourceName}
        currentTier={promotionDialog.currentTier}
        isOpen={promotionDialog.isOpen}
        onClose={() => setPromotionDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleTierConfirm}
      />
    </div>
  );
};

export default SecurityDrop;
