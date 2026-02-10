'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { useVaultStore } from '@/stores/vaultStore'
import { SovereignCertificate } from './SovereignCertificate'
import type { VaultItem } from '@/types/ragbox'

// ============================================================================
// ICONS
// ============================================================================

const FolderIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)

const FileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
)

const PdfIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="2" width="16" height="20" rx="2" fill="#DC2626" opacity="0.2" stroke="#DC2626" strokeWidth="1.5"/>
    <text x="12" y="15" textAnchor="middle" fill="#DC2626" fontSize="6" fontWeight="bold">PDF</text>
  </svg>
)

const DocIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="2" width="16" height="20" rx="2" fill="#2563EB" opacity="0.2" stroke="#2563EB" strokeWidth="1.5"/>
    <text x="12" y="15" textAnchor="middle" fill="#2563EB" fontSize="5" fontWeight="bold">DOC</text>
  </svg>
)

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const UploadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)

const BrainIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-4 4 4 4 0 0 0 4 4v1a4 4 0 0 0 4 4 4 4 0 0 0 4-4v-1a4 4 0 0 0 4-4 4 4 0 0 0-4-4V6a4 4 0 0 0-4-4z"/>
  </svg>
)

const MoveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
  </svg>
)

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)

const StarIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

const CloudIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
  </svg>
)

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const MoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
  </svg>
)

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

// ============================================================================
// TYPES
// ============================================================================

interface VaultFile {
  id: string
  name: string
  type: 'folder' | 'pdf' | 'docx' | 'txt' | 'csv' | 'xlsx'
  size?: number
  modified: Date
  security: 'public' | 'internal' | 'confidential' | 'sovereign'
  indexed: boolean
  citations: number
  relevanceScore: number
  path: string[]
}

interface BreadcrumbItem {
  id: string
  name: string
}

type ViewMode = 'grid' | 'list'
type InspectorTab = 'certificate' | 'activity' | 'related'

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_FILES: VaultFile[] = [
  { id: '1', name: 'Client Contracts', type: 'folder', modified: new Date('2026-02-08'), security: 'confidential', indexed: true, citations: 45, relevanceScore: 0.92, path: ['Home'] },
  { id: '2', name: 'Q4_Financial_Report.pdf', type: 'pdf', size: 2400000, modified: new Date('2026-02-07'), security: 'sovereign', indexed: true, citations: 28, relevanceScore: 0.88, path: ['Home'] },
  { id: '3', name: 'ConnexUS_AI_Product_Documentation.docx', type: 'docx', size: 41459, modified: new Date('2026-02-09'), security: 'internal', indexed: true, citations: 67, relevanceScore: 0.95, path: ['Home'] },
  { id: '4', name: 'Employee_Handbook_2026.pdf', type: 'pdf', size: 5600000, modified: new Date('2026-01-15'), security: 'internal', indexed: true, citations: 12, relevanceScore: 0.65, path: ['Home'] },
  { id: '5', name: 'Legal Briefs', type: 'folder', modified: new Date('2026-02-06'), security: 'sovereign', indexed: true, citations: 89, relevanceScore: 0.97, path: ['Home'] },
  { id: '6', name: 'Compliance_Audit_2025.xlsx', type: 'xlsx', size: 890000, modified: new Date('2026-02-01'), security: 'confidential', indexed: true, citations: 34, relevanceScore: 0.78, path: ['Home'] },
  { id: '7', name: 'Project_Alpha_Specs.docx', type: 'docx', size: 156000, modified: new Date('2026-02-09'), security: 'internal', indexed: false, citations: 0, relevanceScore: 0, path: ['Home'] },
  { id: '8', name: 'Vendor_Agreements', type: 'folder', modified: new Date('2026-02-05'), security: 'confidential', indexed: true, citations: 23, relevanceScore: 0.71, path: ['Home'] },
  { id: '9', name: 'Board_Meeting_Notes.txt', type: 'txt', size: 45000, modified: new Date('2026-02-08'), security: 'sovereign', indexed: true, citations: 56, relevanceScore: 0.89, path: ['Home'] },
  { id: '10', name: 'Marketing_Strategy_Q1.pdf', type: 'pdf', size: 3200000, modified: new Date('2026-02-04'), security: 'internal', indexed: true, citations: 8, relevanceScore: 0.52, path: ['Home'] },
]

const QUICK_ACCESS = [
  { id: 'starred', label: 'Starred', icon: StarIcon, count: 12 },
  { id: 'recent', label: 'Recent', icon: ClockIcon, count: 24 },
  { id: 'whistleblower', label: 'Whistleblower Evidence', icon: AlertIcon, count: 3 },
]

const DRIVES = [
  { id: 'local', label: 'Local Vault', connected: true },
  { id: 'sharepoint', label: 'SharePoint', connected: false },
  { id: 'onedrive', label: 'OneDrive', connected: false },
]

// ============================================================================
// HELPERS
// ============================================================================

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getFileIcon(type: VaultFile['type']) {
  switch (type) {
    case 'folder': return <FolderIcon />
    case 'pdf': return <PdfIcon />
    case 'docx': return <DocIcon />
    default: return <FileIcon />
  }
}

function getSecurityBadge(security: VaultFile['security']) {
  const styles = {
    public: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    internal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    confidential: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    sovereign: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${styles[security]}`}>
      {security}
    </span>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface SovereignExplorerProps {
  onClose?: () => void
}

export function SovereignExplorer({ onClose }: SovereignExplorerProps) {
  const { data: session } = useSession()
  const userName = session?.user?.name || 'Sovereign User'

  // Real vault data
  const vaultDocuments = useVaultStore((s) => s.documents)
  const fetchDocuments = useVaultStore((s) => s.fetchDocuments)
  const fetchFolders = useVaultStore((s) => s.fetchFolders)

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null)
  const [selectedVaultItem, setSelectedVaultItem] = useState<VaultItem | null>(null)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('certificate')
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: 'home', name: 'Home' }])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['quick-access', 'folders']))
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch real documents on mount
  useEffect(() => {
    fetchDocuments()
    fetchFolders()
  }, [fetchDocuments, fetchFolders])

  // Convert real vault documents to VaultFile format for display
  const realFiles = useMemo((): VaultFile[] => {
    return Object.values(vaultDocuments).map((doc) => {
      const ext = doc.name.split('.').pop()?.toLowerCase() || 'file'
      const typeMap: Record<string, VaultFile['type']> = {
        pdf: 'pdf',
        docx: 'docx',
        doc: 'docx',
        txt: 'txt',
        csv: 'csv',
        xlsx: 'xlsx',
        xls: 'xlsx',
        md: 'txt',
      }
      // Simulate citation count based on document age and status
      const daysSinceCreated = Math.floor((Date.now() - new Date(doc.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      const citations = doc.status === 'ready' ? Math.max(0, Math.floor(Math.random() * 50) + daysSinceCreated) : 0
      const relevanceScore = doc.status === 'ready' ? 0.5 + Math.random() * 0.5 : 0

      return {
        id: doc.id,
        name: doc.name,
        type: typeMap[ext] || 'txt',
        size: doc.size,
        modified: new Date(doc.updatedAt),
        security: doc.isPrivileged ? 'sovereign' : doc.securityTier >= 3 ? 'confidential' : doc.securityTier >= 1 ? 'internal' : 'public',
        indexed: doc.status === 'ready',
        citations,
        relevanceScore,
        path: ['Home'],
      }
    })
  }, [vaultDocuments])

  // Combine mock folders with real files
  const allFiles = useMemo(() => {
    const folders = MOCK_FILES.filter(f => f.type === 'folder')
    return [...folders, ...realFiles]
  }, [realFiles])

  // Most cited files for Intelligence Feed
  const mostCited = useMemo(() => {
    return [...allFiles]
      .filter(f => f.type !== 'folder' && f.citations > 0)
      .sort((a, b) => b.citations - a.citations)
      .slice(0, 5)
  }, [allFiles])

  // Filtered files
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return allFiles
    return allFiles.filter(f =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [searchQuery, allFiles])

  // When selecting a file, also find the vault item for the certificate
  const handleSelectFile = (file: VaultFile) => {
    setSelectedFile(file)
    const vaultItem = vaultDocuments[file.id]
    setSelectedVaultItem(vaultItem || null)
  }

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="h-full flex flex-col bg-[#0A192F] text-white overflow-hidden">

      {/* ========== COMMAND DECK (Top Bar) ========== */}
      <div className="shrink-0 bg-[#0A192F] border-b border-white/10">
        {/* Breadcrumbs Row */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
          <div className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={crumb.id}>
                {i > 0 && <ChevronRight />}
                <button className="px-2 py-1 rounded hover:bg-white/10 transition-colors text-slate-300 hover:text-white">
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <SearchIcon />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vault..."
              className="w-64 h-8 pl-8 pr-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              style={{ paddingLeft: '2rem' }}
            />
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
              <SearchIcon />
            </div>
          </div>
        </div>

        {/* Toolbar Row */}
        <div className="flex items-center gap-2 px-4 py-2">
          {/* New Button */}
          <button className="flex items-center gap-2 px-3 py-1.5 bg-[#2463EB] hover:bg-[#3b7aff] text-white text-sm font-medium rounded-lg transition-all">
            <PlusIcon />
            New
          </button>

          <div className="w-px h-6 bg-white/10" />

          {/* Action Buttons */}
          <ToolbarButton icon={<UploadIcon />} label="Upload" />
          <ToolbarButton icon={<BrainIcon />} label="Vectorize" />
          <ToolbarButton icon={<MoveIcon />} label="Move To" />
          <ToolbarButton icon={<ShieldIcon />} label="Security" />

          <div className="flex-1" />

          {/* View Toggle */}
          <div className="flex items-center bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              <ListIcon />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              <GridIcon />
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <XIcon />
            </button>
          )}
        </div>
      </div>

      {/* ========== MAIN CONTENT ========== */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ========== LEFT RAIL (Tree Navigation) ========== */}
        <nav className="w-56 shrink-0 bg-[#0D1F3C] border-r border-white/10 overflow-y-auto py-3">

          {/* Quick Access */}
          <TreeSection
            id="quick-access"
            label="Quick Access"
            expanded={expandedFolders.has('quick-access')}
            onToggle={() => toggleFolder('quick-access')}
          >
            {QUICK_ACCESS.map(item => {
              const Icon = item.icon
              return (
                <button key={item.id} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-lg transition-all">
                  <Icon filled={item.id === 'starred'} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className="text-xs text-slate-500">{item.count}</span>
                </button>
              )
            })}
          </TreeSection>

          {/* Drives */}
          <TreeSection
            id="drives"
            label="Drives"
            expanded={expandedFolders.has('drives')}
            onToggle={() => toggleFolder('drives')}
          >
            {DRIVES.map(drive => (
              <button key={drive.id} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-lg transition-all">
                <CloudIcon />
                <span className="flex-1 text-left">{drive.label}</span>
                {drive.connected ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                ) : (
                  <span className="text-[10px] text-slate-500">Connect</span>
                )}
              </button>
            ))}
          </TreeSection>

          {/* Folders */}
          <TreeSection
            id="folders"
            label="Folders"
            expanded={expandedFolders.has('folders')}
            onToggle={() => toggleFolder('folders')}
          >
            {MOCK_FILES.filter(f => f.type === 'folder').map(folder => (
              <button key={folder.id} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-lg transition-all">
                <FolderIcon />
                <span className="flex-1 text-left truncate">{folder.name}</span>
              </button>
            ))}
          </TreeSection>
        </nav>

        {/* ========== CENTER STAGE ========== */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Intelligence Feed */}
          <div className="shrink-0 px-4 py-3 border-b border-white/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                Intelligence Feed
              </h3>
              <span className="text-xs text-slate-500">Most Cited Evidence</span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {mostCited.length > 0 ? mostCited.map(file => (
                <motion.button
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`shrink-0 w-48 p-3 rounded-xl border transition-all duration-150 ${
                    selectedFile?.id === file.id
                      ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_25px_-5px_rgba(6,182,212,0.4)]'
                      : 'bg-white/[0.03] border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`${file.type === 'folder' ? 'text-amber-400' : 'text-slate-400'}`}>
                      {getFileIcon(file.type)}
                    </div>
                    <span className="text-xs font-medium text-white truncate flex-1">{file.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-cyan-400 font-bold">Cited {file.citations}×</span>
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${file.relevanceScore * 100}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                </motion.button>
              )) : (
                <div className="flex items-center gap-3 px-4 py-6 text-slate-500">
                  <BrainIcon />
                  <span className="text-sm">Upload documents to see Intelligence Feed</span>
                </div>
              )}
            </div>
          </div>

          {/* File Matrix */}
          <div className="flex-1 overflow-auto">
            {viewMode === 'list' ? (
              <table className="w-full">
                <thead className="sticky top-0 bg-[#0A192F] z-10">
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/10">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium w-24">Status</th>
                    <th className="px-4 py-3 font-medium w-28">Security</th>
                    <th className="px-4 py-3 font-medium w-32">Modified</th>
                    <th className="px-4 py-3 font-medium w-24">Size</th>
                    <th className="px-4 py-3 font-medium w-32">Relevance</th>
                    <th className="px-4 py-3 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map(file => (
                    <motion.tr
                      key={file.id}
                      onClick={() => handleSelectFile(file)}
                      initial={false}
                      animate={{
                        backgroundColor: selectedFile?.id === file.id ? 'rgba(6, 182, 212, 0.08)' : 'transparent'
                      }}
                      className={`
                        border-b border-white/5 cursor-pointer transition-all duration-150
                        hover:bg-white/[0.03]
                        ${selectedFile?.id === file.id
                          ? 'bg-cyan-500/10 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.3),0_0_20px_-10px_rgba(6,182,212,0.4)]'
                          : ''
                        }
                      `}
                      style={{
                        borderRadius: selectedFile?.id === file.id ? '8px' : '0',
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`${file.type === 'folder' ? 'text-amber-400' : 'text-slate-400'}`}>
                            {getFileIcon(file.type)}
                          </div>
                          <span className="text-sm text-white font-medium truncate max-w-[300px]">
                            {file.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {file.indexed ? (
                            <>
                              <BrainIcon />
                              <span className="text-xs text-emerald-400">Indexed</span>
                            </>
                          ) : (
                            <>
                              <CloudIcon />
                              <span className="text-xs text-slate-500">Pending</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">{getSecurityBadge(file.security)}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{formatDate(file.modified)}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{formatFileSize(file.size)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                              style={{ width: `${file.relevanceScore * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{Math.round(file.relevanceScore * 100)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button className="p-1 text-slate-500 hover:text-white hover:bg-white/10 rounded transition-all">
                          <MoreIcon />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-4 gap-4 p-4">
                {filteredFiles.map(file => (
                  <motion.button
                    key={file.id}
                    onClick={() => handleSelectFile(file)}
                    whileHover={{ scale: 1.01, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    className={`
                      p-4 rounded-xl border text-left transition-all duration-150
                      ${selectedFile?.id === file.id
                        ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_30px_-10px_rgba(6,182,212,0.5),inset_0_0_0_1px_rgba(6,182,212,0.2)]'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                      }
                    `}
                  >
                    <div className={`mb-3 ${file.type === 'folder' ? 'text-amber-400' : 'text-slate-400'}`}>
                      {getFileIcon(file.type)}
                    </div>
                    <p className="text-sm font-medium text-white truncate mb-1">{file.name}</p>
                    <p className="text-xs text-slate-500">{formatDate(file.modified)}</p>
                    <div className="flex items-center justify-between mt-2">
                      {getSecurityBadge(file.security)}
                      {file.citations > 0 && (
                        <span className="text-[10px] text-cyan-400">{file.citations}×</span>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========== DEEP INSPECTOR (Right Panel) ========== */}
        <AnimatePresence>
          {selectedFile && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="shrink-0 bg-[#0D1F3C] border-l border-white/10 overflow-hidden"
            >
              <div className="w-80 h-full flex flex-col">
                {/* Header */}
                <div className="shrink-0 p-4 border-b border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${selectedFile.type === 'folder' ? 'bg-amber-500/20 text-amber-400' : 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400'}`}>
                        {getFileIcon(selectedFile.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate max-w-[180px]">{selectedFile.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-500 uppercase">{selectedFile.type}</span>
                          {selectedFile.indexed && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Indexed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedFile(null); setSelectedVaultItem(null); }}
                      className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                    >
                      <XIcon />
                    </button>
                  </div>
                  {/* Quick Action: Chat with this file */}
                  {selectedFile.type !== 'folder' && (
                    <button
                      onClick={onClose}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#00F0FF] hover:bg-[#00d4e0] text-black text-xs font-semibold transition-all shadow-[0_0_20px_-5px_rgba(0,240,255,0.4)]"
                    >
                      <BrainIcon />
                      Chat with this File
                    </button>
                  )}
                </div>

                {/* Tabs */}
                <div className="shrink-0 flex border-b border-white/10">
                  {(['certificate', 'activity', 'related'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setInspectorTab(tab)}
                      className={`flex-1 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-all ${
                        inspectorTab === tab
                          ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                          : 'text-slate-500 hover:text-white'
                      }`}
                    >
                      {tab === 'certificate' ? 'Custody' : tab}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {inspectorTab === 'certificate' && (
                    <div className="space-y-4">
                      {/* Sovereign Certificate - The Star of the Show */}
                      {selectedVaultItem ? (
                        <SovereignCertificate document={selectedVaultItem} userName={userName} />
                      ) : (
                        <div className="p-4 rounded-xl border border-amber-500/20 bg-[#020408]">
                          <div className="text-center py-6">
                            <ShieldIcon />
                            <p className="text-xs text-slate-500 mt-2">Certificate pending index</p>
                          </div>
                        </div>
                      )}

                      {/* Citation History */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/20">
                        <div className="flex items-center gap-2 mb-3">
                          <BrainIcon />
                          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Citation History</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-xs text-slate-400">Times Cited by Mercury</span>
                            <span className="text-sm font-bold text-white">{selectedFile.citations}×</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-xs text-slate-400">Relevance Score</span>
                            <span className="text-sm font-medium text-cyan-400">{Math.round(selectedFile.relevanceScore * 100)}%</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-xs text-slate-400">Last Queried</span>
                            <span className="text-xs text-slate-500">2 hours ago</span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Properties */}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-slate-500">Size</span>
                          <span className="text-slate-300 font-mono">{formatFileSize(selectedFile.size)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-slate-500">Modified</span>
                          <span className="text-slate-300">{formatDate(selectedFile.modified)}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-slate-500">Security</span>
                          {getSecurityBadge(selectedFile.security)}
                        </div>
                      </div>
                    </div>
                  )}

                  {inspectorTab === 'activity' && (
                    <div className="space-y-3">
                      <ActivityItem
                        action="Analyzed by Mercury"
                        time="5 minutes ago"
                        detail="Generated 12 new embeddings"
                      />
                      <ActivityItem
                        action="Cited in Query"
                        time="23 minutes ago"
                        detail="'What are the Q4 projections?'"
                      />
                      <ActivityItem
                        action="Uploaded by User"
                        time="Feb 7, 2026"
                        detail="Initial upload via drag-and-drop"
                      />
                      <ActivityItem
                        action="Security Updated"
                        time="Feb 6, 2026"
                        detail={`Changed to ${selectedFile.security}`}
                      />
                    </div>
                  )}

                  {inspectorTab === 'related' && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 mb-3">Documents with similar content</p>
                      {allFiles.filter(f => f.id !== selectedFile.id && f.type !== 'folder').slice(0, 4).map(file => (
                        <button
                          key={file.id}
                          onClick={() => handleSelectFile(file)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-cyan-500/20 transition-all"
                        >
                          <div className="text-slate-400">{getFileIcon(file.type)}</div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm text-slate-300 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-600">Relevance: {Math.round(file.relevanceScore * 100)}%</p>
                          </div>
                        </button>
                      ))}
                      {allFiles.filter(f => f.id !== selectedFile.id && f.type !== 'folder').length === 0 && (
                        <p className="text-xs text-slate-600 text-center py-4">No related documents found</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ToolbarButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-white/10 text-sm rounded-lg transition-all">
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}

function TreeSection({
  id,
  label,
  expanded,
  onToggle,
  children,
}: {
  id: string
  label: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider hover:text-white transition-colors"
      >
        <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight />
        </motion.span>
        {label}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pl-2 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-white break-all">{value}</p>
    </div>
  )
}

function ActivityItem({ action, time, detail }: { action: string; time: string; detail: string }) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-white">{action}</p>
        <span className="text-[10px] text-slate-500">{time}</span>
      </div>
      <p className="text-xs text-slate-400">{detail}</p>
    </div>
  )
}

export default SovereignExplorer
