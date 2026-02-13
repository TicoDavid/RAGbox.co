import type { VaultItem, FolderNode } from '@/types/ragbox'
import type { SecurityTier } from '../security'
import { tierToSecurity } from '../security'
import type { ExplorerItem } from './explorer-types'

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '\u2014'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getFileType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const types: Record<string, string> = {
    pdf: 'PDF Document',
    doc: 'Word Document',
    docx: 'Word Document',
    xls: 'Excel Spreadsheet',
    xlsx: 'Excel Spreadsheet',
    txt: 'Text File',
    md: 'Markdown',
    csv: 'CSV Data',
    json: 'JSON File',
  }
  return types[ext] || 'Document'
}

export function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || 'file'
}

export function vaultItemToExplorerItem(
  doc: VaultItem,
): ExplorerItem {
  const security = tierToSecurity(doc.securityTier ?? 1)
  const isIndexed = doc.status === 'Indexed' || doc.status === 'ready'
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(doc.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  )
  const citations = isIndexed ? Math.max(0, Math.floor(Math.random() * 50) + daysSinceCreated) : 0
  const relevanceScore = isIndexed ? 0.5 + Math.random() * 0.5 : 0

  return {
    id: doc.id,
    name: doc.name,
    type: 'document',
    size: doc.size ?? 0,
    updatedAt: new Date(doc.updatedAt),
    security,
    isIndexed,
    isStarred: doc.isStarred ?? false,
    citations,
    relevanceScore,
  }
}

export function buildPathFromFolder(
  folderId: string | null,
  folders: Record<string, FolderNode>,
): string[] {
  if (!folderId) return []
  const path: string[] = []
  let currentId: string | null = folderId
  while (currentId) {
    path.unshift(currentId)
    currentId = folders[currentId]?.parentId || null
  }
  return path
}
