'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { useVaultStore } from '@/stores/vaultStore'
import { SECURITY_TIERS } from '../security'
import type { SecurityTier } from '../security'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'
import { VaultAccessModal, type ClearanceLevel, type VaultMember, type LinkExpiration } from '../VaultAccessModal'
import IngestionModal from '@/app/dashboard/components/IngestionModal'
import type { ExplorerItem, ViewMode, SortField } from './explorer-types'
import { vaultItemToExplorerItem, buildPathFromFolder } from './explorer-utils'
import { CommandDeck } from './CommandDeck'
import { NavigationTree } from './NavigationTree'
import { IntelligenceFeed } from './IntelligenceFeed'
import { FileMatrix } from './FileMatrix'
import { DeepInspector } from './DeepInspector'

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface SovereignExplorerProps {
  onClose?: () => void
}

export function SovereignExplorer({ onClose }: SovereignExplorerProps) {
  const { data: session } = useSession()
  const userName = session?.user?.name || 'Sovereign User'

  // Store connections
  const documents = useVaultStore((s) => s.documents)
  const folders = useVaultStore((s) => s.folders)
  const fetchDocuments = useVaultStore((s) => s.fetchDocuments)
  const fetchFolders = useVaultStore((s) => s.fetchFolders)
  const createFolder = useVaultStore((s) => s.createFolder)
  const deleteDocument = useVaultStore((s) => s.deleteDocument)
  const selectAndChat = useVaultStore((s) => s.selectAndChat)
  const uploadDocuments = useVaultStore((s) => s.uploadDocuments)
  const navigate = useVaultStore((s) => s.navigate)
  const toggleStar = useVaultStore((s) => s.toggleStar)

  // Local UI state
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortAsc, setSortAsc] = useState(false)

  // Quick access filter (null = none, 'starred' = starred, 'recent' = recent)
  const [quickAccessFilter, setQuickAccessFilter] = useState<string | null>(null)

  // Modal state
  const [isIngestionOpen, setIsIngestionOpen] = useState(false)
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false)
  const [isVectorizing, setIsVectorizing] = useState(false)


  // Vault access modal state
  const [vaultMembers, setVaultMembers] = useState<VaultMember[]>([])

  // Fetch on mount
  useEffect(() => {
    fetchDocuments()
    fetchFolders()
  }, [fetchDocuments, fetchFolders])

  // ── Derived data ──────────────────────────────────────────────────────

  const currentPath = useMemo(
    () => buildPathFromFolder(selectedFolderId, folders),
    [selectedFolderId, folders],
  )

  // Convert vault items → ExplorerItems for current folder
  const currentFolderItems: ExplorerItem[] = useMemo(() => {
    const items: ExplorerItem[] = []

    // Add subfolders
    Object.values(folders).forEach((f) => {
      if ((selectedFolderId === null && !f.parentId) || f.parentId === selectedFolderId) {
        items.push({
          id: f.id,
          name: f.name,
          type: 'folder',
          updatedAt: new Date(),
          size: 0,
          security: 'general',
          isIndexed: true,
          isStarred: false,
          citations: 0,
          relevanceScore: 0,
        })
      }
    })

    // Add documents in current folder
    Object.values(documents).forEach((d) => {
      const inCurrentFolder = selectedFolderId === null
        ? !d.folderId
        : d.folderId === selectedFolderId
      if (inCurrentFolder) {
        items.push(
          vaultItemToExplorerItem(d),
        )
      }
    })

    return items
  }, [documents, folders, selectedFolderId])

  // Compute starred and recent counts from all documents
  const starredCount = useMemo(
    () => Object.values(documents).filter((d) => d.isStarred).length,
    [documents],
  )
  const recentCount = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return Object.values(documents).filter(
      (d) => new Date(d.createdAt).getTime() > sevenDaysAgo,
    ).length
  }, [documents])

  // Filter by search + quick access
  const filteredItems = useMemo(() => {
    let items = currentFolderItems

    // Quick access filter (applies across all folders)
    if (quickAccessFilter === 'starred') {
      items = items.filter((i) => i.isStarred)
    } else if (quickAccessFilter === 'recent') {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      items = items.filter((i) => i.updatedAt.getTime() > sevenDaysAgo)
    }

    if (!searchQuery) return items
    const q = searchQuery.toLowerCase()
    return items.filter((item) => item.name.toLowerCase().includes(q))
  }, [currentFolderItems, searchQuery, quickAccessFilter])

  // Sort
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      // Folders first
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'updatedAt': cmp = b.updatedAt.getTime() - a.updatedAt.getTime(); break
        case 'size': cmp = b.size - a.size; break
        case 'security': {
          const order: Record<SecurityTier, number> = { general: 0, internal: 1, confidential: 2, sovereign: 3 }
          cmp = order[a.security] - order[b.security]
          break
        }
        case 'relevanceScore': cmp = b.relevanceScore - a.relevanceScore; break
      }
      return sortAsc ? -cmp : cmp
    })
  }, [filteredItems, sortField, sortAsc])

  // Most cited for Intelligence Feed
  const mostCited = useMemo(() => {
    return [...currentFolderItems]
      .filter((f) => f.type !== 'folder' && f.citations > 0)
      .sort((a, b) => b.citations - a.citations)
      .slice(0, 5)
  }, [currentFolderItems])

  // Selected item lookup
  const selectedItem = sortedItems.find((i) => i.id === selectedId) || null
  const selectedVaultItem = selectedId ? documents[selectedId] ?? null : null

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSelectFolder = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId)
    setSelectedId(null)
    navigate(buildPathFromFolder(folderId, folders))
  }, [folders, navigate])

  const handleToggleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortAsc((prev) => !prev)
    else { setSortField(field); setSortAsc(false) }
  }, [sortField])

  const handleDoubleClick = useCallback((item: ExplorerItem) => {
    if (item.type === 'folder') {
      handleSelectFolder(item.id)
    } else {
      selectAndChat(item.id)
    }
  }, [handleSelectFolder, selectAndChat])

  const handleNewFolder = useCallback(async () => {
    const name = window.prompt('Folder name:')
    if (!name?.trim()) return
    await createFolder(name.trim(), selectedFolderId || undefined)
  }, [createFolder, selectedFolderId])

  const handleSecurityChange = useCallback(async (docId: string, security: SecurityTier) => {
    const tier = SECURITY_TIERS[security].level
    try {
      const res = await apiFetch(`/api/documents/${docId}/tier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      if (!res.ok) throw new Error('Failed to update security tier')
      toast.success(`Security updated to ${SECURITY_TIERS[security].label}`)
      await fetchDocuments()
    } catch {
      toast.error('Failed to update security tier')
    }
  }, [fetchDocuments])

  const handleIndexToggle = useCallback(async (docId: string, enabled: boolean) => {
    try {
      if (enabled) {
        const res = await apiFetch(`/api/documents/${docId}/ingest`, { method: 'POST' })
        if (!res.ok) throw new Error('Failed to start indexing')
        toast.success('Indexing started')
      } else {
        const res = await apiFetch(`/api/documents/${docId}/chunks`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to remove embeddings')
        toast.success('Embeddings removed')
      }
      await fetchDocuments()
    } catch {
      toast.error(enabled ? 'Failed to start indexing' : 'Failed to remove embeddings')
    }
  }, [fetchDocuments])

  const handleDelete = useCallback((id: string) => {
    deleteDocument(id)
    setSelectedId(null)
  }, [deleteDocument])

  const handleDownload = useCallback(async (docId: string) => {
    try {
      const res = await apiFetch(`/api/documents/${docId}/download`)
      if (!res.ok) throw new Error('Download failed')
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      }
    } catch {
      toast.error('Failed to download document')
    }
  }, [])

  const handleAuditLog = useCallback(async (docId: string) => {
    try {
      const res = await apiFetch(`/api/audit?documentId=${docId}`)
      if (!res.ok) throw new Error('Failed to fetch audit log')
      const data = await res.json()
      const logs = data.logs ?? data.data ?? []
      if (logs.length === 0) {
        toast.info('No audit logs found for this document')
      } else {
        toast.success(`${logs.length} audit log entries found`)
      }
    } catch {
      toast.error('Failed to fetch audit log')
    }
  }, [])

  const handleVerifyIntegrity = useCallback(async (docId: string) => {
    try {
      const res = await apiFetch(`/api/documents/${docId}/verify`, { method: 'POST' })
      if (!res.ok) throw new Error('Verification failed')
      const data = await res.json()
      if (data.valid) {
        toast.success('Integrity verified: checksums match')
      } else {
        toast.error(`Integrity check failed: ${data.reason ?? 'checksum mismatch'}`)
      }
    } catch {
      toast.error('Failed to verify integrity')
    }
  }, [])

  const handleToggleStar = useCallback(async (docId: string) => {
    try {
      await toggleStar(docId)
    } catch {
      // toast already shown by store
    }
  }, [toggleStar])

  const handleIngestionUpload = useCallback(async (files: File[]) => {
    await uploadDocuments(files, selectedFolderId || undefined)
    setIsIngestionOpen(false)
  }, [uploadDocuments, selectedFolderId])

  const handleChat = useCallback(() => {
    if (selectedId) selectAndChat(selectedId)
  }, [selectedId, selectAndChat])

  const handleVectorize = useCallback(async () => {
    const pendingDocs = Object.values(documents).filter(
      (d) => d.status === 'Pending' || d.status === 'pending',
    )
    if (pendingDocs.length === 0) {
      toast.info('No pending documents to vectorize')
      return
    }
    setIsVectorizing(true)
    try {
      let success = 0
      for (const doc of pendingDocs) {
        const res = await apiFetch(`/api/documents/${doc.id}/ingest`, { method: 'POST' })
        if (res.ok) success++
      }
      toast.success(`Vectorization started for ${success} document${success !== 1 ? 's' : ''}`)
      await fetchDocuments()
    } catch {
      toast.error('Batch vectorization failed')
    } finally {
      setIsVectorizing(false)
    }
  }, [documents, fetchDocuments])

  const handleMoveTo = useCallback(async () => {
    const selectedIds = useVaultStore.getState().selectedDocumentIds
    if (selectedIds.length === 0) {
      toast.info('Select documents first to move them')
      return
    }
    const folderName = window.prompt('Enter target folder name (or leave empty for root):')
    if (folderName === null) return // cancelled

    const targetFolderId = folderName.trim()
      ? Object.values(folders).find((f) => f.name === folderName.trim())?.id ?? null
      : null

    if (folderName.trim() && !targetFolderId) {
      toast.error('Folder not found')
      return
    }

    try {
      for (const docId of selectedIds) {
        await apiFetch(`/api/documents/${docId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId: targetFolderId }),
        })
      }
      useVaultStore.getState().clearSelection()
      await fetchDocuments()
      toast.success(`Moved ${selectedIds.length} document${selectedIds.length !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Failed to move documents')
    }
  }, [folders, fetchDocuments])

  // Vault access modal handlers
  const currentVaultName = selectedFolderId
    ? folders[selectedFolderId]?.name || 'Vault'
    : 'Primary Vault'

  const handleGrantAccess = useCallback(async (email: string, clearance: ClearanceLevel) => {
    const newMember: VaultMember = {
      id: crypto.randomUUID(),
      email,
      name: email.split('@')[0],
      clearance,
      addedAt: new Date(),
      addedBy: 'current-user',
    }
    setVaultMembers((prev) => [...prev, newMember])
  }, [])

  const handleRevokeClearance = useCallback(async (memberId: string) => {
    setVaultMembers((prev) => prev.filter((m) => m.id !== memberId))
  }, [])

  const handleUpdateClearance = useCallback(async (memberId: string, newClearance: ClearanceLevel) => {
    setVaultMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, clearance: newClearance } : m))
    )
  }, [])

  const handleGenerateLink = useCallback(async (expiration: LinkExpiration): Promise<string> => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return `https://ragbox.co/v/${token}?exp=${expiration}`
  }, [])

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[#0A192F] text-white overflow-hidden">
      <CommandDeck
        currentPath={currentPath}
        folders={folders}
        searchQuery={searchQuery}
        viewMode={viewMode}
        isVectorizing={isVectorizing}
        onNavigate={handleSelectFolder}
        onSearchChange={setSearchQuery}
        onViewModeChange={setViewMode}
        onNewFolder={handleNewFolder}
        onUpload={() => setIsIngestionOpen(true)}
        onVectorize={handleVectorize}
        onMoveTo={handleMoveTo}
        onSecurity={() => setIsAccessModalOpen(true)}
        onClose={onClose}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <NavigationTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          activeFilter={quickAccessFilter}
          starredCount={starredCount}
          recentCount={recentCount}
          onSelectFolder={handleSelectFolder}
          onQuickAccessFilter={setQuickAccessFilter}
        />

        {/* Center Stage */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <IntelligenceFeed
            items={mostCited}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          <FileMatrix
            items={sortedItems}
            viewMode={viewMode}
            selectedId={selectedId}
            sortField={sortField}
            sortAsc={sortAsc}
            onSelect={setSelectedId}
            onDoubleClick={handleDoubleClick}
            onToggleSort={handleToggleSort}
            onToggleStar={handleToggleStar}
          />
        </div>

        {/* Deep Inspector */}
        <AnimatePresence>
          {selectedItem && (
            <DeepInspector
              item={selectedItem}
              vaultItem={selectedVaultItem}
              userName={userName}
              allItems={currentFolderItems}
              onClose={() => setSelectedId(null)}
              onChat={handleChat}
              onDelete={handleDelete}
              onSecurityChange={handleSecurityChange}
              onIndexToggle={handleIndexToggle}
              onSelectItem={setSelectedId}
              onDownload={handleDownload}
              onAuditLog={handleAuditLog}
              onVerifyIntegrity={handleVerifyIntegrity}
              onToggleStar={handleToggleStar}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <IngestionModal
        isOpen={isIngestionOpen}
        onClose={() => setIsIngestionOpen(false)}
        onFileUpload={handleIngestionUpload}
      />

      <VaultAccessModal
        isOpen={isAccessModalOpen}
        onClose={() => setIsAccessModalOpen(false)}
        vaultName={currentVaultName}
        vaultId={selectedFolderId || 'root'}
        currentMembers={vaultMembers}
        onGrantAccess={handleGrantAccess}
        onRevokeClearance={handleRevokeClearance}
        onUpdateClearance={handleUpdateClearance}
        onGenerateLink={handleGenerateLink}
      />
    </div>
  )
}

export default SovereignExplorer
