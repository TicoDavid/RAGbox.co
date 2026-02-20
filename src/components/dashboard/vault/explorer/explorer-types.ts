import type { SecurityTier } from '../security'

export interface ExplorerItem {
  id: string
  name: string
  type: 'folder' | 'document'
  updatedAt: Date
  size: number
  security: SecurityTier
  isIndexed: boolean
  isStarred: boolean
  citations: number
  relevanceScore: number
}

export type ViewMode = 'grid' | 'list'

export type SortField = 'name' | 'security' | 'updatedAt' | 'size' | 'relevanceScore'

export type InspectorTab = 'certificate' | 'activity'
