'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { useVaultStore } from '@/stores/vaultStore'
import { tierToSecurity } from '../security'
import type { SecurityTier } from '../security'
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
  const uploadDocument = useVaultStore((s) => s.uploadDocument)
  const navigate = useVaultStore((s) => s.navigate)

  // Local UI state
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortAsc, setSortAsc] = useState(false)

  // Modal state
  const [isIngestionOpen, setIsIngestionOpen] = useState(false)
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false)

  // Security/index overrides (local until backend supports tier mutations)
  const [securityOverrides, setSecurityOverrides] = useState<Record<string, SecurityTier>>({})
  const [indexOverrides, setIndexOverrides] = useState<Record<string, boolean>>({})

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
          vaultItemToExplorerItem(d, securityOverrides[d.id], indexOverrides[d.id]),
        )
      }
    })

    return items
  }, [documents, folders, selectedFolderId, securityOverrides, indexOverrides])

  // Filter by search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return currentFolderItems
    const q = searchQuery.toLowerCase()
    return currentFolderItems.filter((item) => item.name.toLowerCase().includes(q))
  }, [currentFolderItems, searchQuery])

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

  const handleSecurityChange = useCallback((docId: string, security: SecurityTier) => {
    setSecurityOverrides((prev) => ({ ...prev, [docId]: security }))
  }, [])

  const handleIndexToggle = useCallback((docId: string, enabled: boolean) => {
    setIndexOverrides((prev) => ({ ...prev, [docId]: enabled }))
  }, [])

  const handleDelete = useCallback((id: string) => {
    deleteDocument(id)
    setSelectedId(null)
  }, [deleteDocument])

  const handleIngestionUpload = useCallback(async (files: File[]) => {
    for (const file of files) {
      await uploadDocument(file, selectedFolderId || undefined)
    }
    setIsIngestionOpen(false)
  }, [uploadDocument, selectedFolderId])

  const handleChat = useCallback(() => {
    if (selectedId) selectAndChat(selectedId)
  }, [selectedId, selectAndChat])

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
        onNavigate={handleSelectFolder}
        onSearchChange={setSearchQuery}
        onViewModeChange={setViewMode}
        onNewFolder={handleNewFolder}
        onUpload={() => setIsIngestionOpen(true)}
        onSecurity={() => setIsAccessModalOpen(true)}
        onClose={onClose}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <NavigationTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={handleSelectFolder}
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
