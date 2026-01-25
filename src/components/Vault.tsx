'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  File,
  FileText,
  FileSpreadsheet,
  Lock,
  Unlock,
  Trash2,
  Shield,
  ShieldOff,
  AlertTriangle,
  X,
  RefreshCw,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRagSounds } from '@/hooks/useRagSounds'
import { usePrivilege } from '@/contexts/PrivilegeContext'
import { useDocuments, Document } from '@/hooks/useDocuments'

// Context menu state
interface ContextMenuState {
  isOpen: boolean
  x: number
  y: number
  fileId: string | null
}

/**
 * Vault Component - Center Stage
 *
 * Features:
 * - "Feed the Box" drop zone with Electric Blue glow
 * - File list with Privilege Mode toggle (Grey -> Red)
 * - Wireframe cube animation
 * - Real document fetching from API
 */
export function Vault() {
  const [isDragOver, setIsDragOver] = useState(false)

  // Fetch documents from API
  const {
    documents,
    isLoading: documentsLoading,
    error: documentsError,
    refetch,
    deleteDocument,
    togglePrivilege: toggleDocPrivilege,
  } = useDocuments()

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    fileId: null,
  })

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    fileId: string | null
    fileName: string
    action: 'mark' | 'unmark'
  }>({
    isOpen: false,
    fileId: null,
    fileName: '',
    action: 'mark',
  })

  // Global privilege mode context
  const { isPrivileged: globalPrivilegeMode, togglePrivilege: toggleGlobalPrivilege, isLoading: privilegeLoading } = usePrivilege()

  // Audio UI - The "RAG" sounds
  const { playLockSound, playDropSound } = useRagSounds()

  // Filter files based on global privilege mode
  const visibleFiles = useMemo(() => {
    if (globalPrivilegeMode) {
      // Privilege mode ON: show only privileged documents
      return documents.filter((doc) => doc.isPrivileged)
    }
    // Normal mode: show all non-privileged documents
    return documents.filter((doc) => !doc.isPrivileged)
  }, [documents, globalPrivilegeMode])

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu((prev) => ({ ...prev, isOpen: false }))
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      // AUDIO UI: Play absorption sound
      playDropSound()

      // Upload files to the API
      for (const file of droppedFiles) {
        try {
          // In production, upload to Cloud Storage first, then create document record
          const response = await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              size: file.size,
              mimeType: file.type,
              storagePath: `users/demo/documents/${Date.now()}_${file.name}`,
            }),
          })

          if (response.ok) {
            // Refetch documents to show the new one
            refetch()
          }
        } catch (error) {
          console.error('Failed to upload file:', error)
        }
      }
    }
  }, [playDropSound, refetch])

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, fileId: string) => {
    e.preventDefault()
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      fileId,
    })
  }, [])

  // Request privilege toggle (with confirmation for unmarking)
  const requestPrivilegeToggle = useCallback((id: string) => {
    const doc = documents.find((d) => d.id === id)
    if (!doc) return

    // If unmarking privilege, check safety and show confirmation
    if (doc.isPrivileged) {
      // Safety check: Cannot unmark in privileged mode
      if (globalPrivilegeMode) {
        alert('Cannot remove privilege protection while in Privileged Mode. Exit Privileged Mode first.')
        return
      }

      // Show confirmation dialog
      setConfirmDialog({
        isOpen: true,
        fileId: id,
        fileName: doc.name,
        action: 'unmark',
      })
    } else {
      // Marking as privileged - no confirmation needed
      executePrivilegeToggle(id, true)
    }
  }, [documents, globalPrivilegeMode])

  // Execute the privilege toggle (after confirmation if needed)
  const executePrivilegeToggle = useCallback(async (id: string, newPrivilegeState: boolean) => {
    // AUDIO UI: Play metallic deadbolt click
    playLockSound()

    // Use the hook's togglePrivilege function
    const success = await toggleDocPrivilege(id, newPrivilegeState, !newPrivilegeState)
    if (!success) {
      console.error('Failed to update privilege')
    }
  }, [playLockSound, toggleDocPrivilege])

  // Handle confirmation dialog
  const handleConfirmPrivilegeChange = useCallback(() => {
    if (confirmDialog.fileId) {
      executePrivilegeToggle(confirmDialog.fileId, confirmDialog.action === 'mark')
    }
    setConfirmDialog({ isOpen: false, fileId: null, fileName: '', action: 'mark' })
  }, [confirmDialog, executePrivilegeToggle])

  // Legacy toggle function (for button click)
  const togglePrivilege = (id: string) => {
    requestPrivilegeToggle(id)
  }

  const deleteFile = async (id: string) => {
    const success = await deleteDocument(id)
    if (!success) {
      console.error('Failed to delete document')
    }
  }

  return (
    <motion.main
      className={cn(
        'flex-1 h-screen overflow-y-auto',
        'dark:bg-void bg-ceramic',
        'p-8'
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header with Global Privilege Toggle */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-start justify-between"
        >
          <div>
            <h1 className="text-3xl font-extrabold dark:text-white text-black">
              The Box
            </h1>
            <p className="text-sm dark:text-white/40 text-black/40 mt-1">
              {globalPrivilegeMode
                ? 'Viewing privileged documents only'
                : 'Feed your documents. Interrogate with confidence.'}
            </p>
          </div>

          {/* Global Privilege Mode Toggle */}
          <motion.button
            onClick={toggleGlobalPrivilege}
            disabled={privilegeLoading}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl',
              'text-sm font-semibold',
              'transition-all duration-300',
              'border-2',
              globalPrivilegeMode
                ? cn(
                    'bg-privilege/20 text-privilege border-privilege',
                    'shadow-[0_0_20px_rgba(255,61,0,0.3)]'
                  )
                : cn(
                    'dark:bg-white/5 bg-black/5',
                    'dark:text-white/60 text-black/60',
                    'dark:border-white/20 border-black/10',
                    'dark:hover:bg-white/10 hover:bg-black/10'
                  ),
              privilegeLoading && 'opacity-50 cursor-not-allowed'
            )}
            whileHover={{ scale: privilegeLoading ? 1 : 1.02 }}
            whileTap={{ scale: privilegeLoading ? 1 : 0.98 }}
          >
            {globalPrivilegeMode ? (
              <>
                <Shield className="w-5 h-5" strokeWidth={2.5} />
                <span>Privileged Mode</span>
              </>
            ) : (
              <>
                <ShieldOff className="w-5 h-5" strokeWidth={2} />
                <span>Normal Mode</span>
              </>
            )}
          </motion.button>
        </motion.div>

        {/* Drop Zone */}
        <DropZone
          isDragOver={isDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />

        {/* File List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold dark:text-white text-black">
              {globalPrivilegeMode ? 'Privileged Documents' : 'Documents'} ({visibleFiles.length})
              {globalPrivilegeMode && documents.filter(d => !d.isPrivileged).length > 0 && (
                <span className="text-sm font-normal dark:text-white/40 text-black/40 ml-2">
                  ({documents.filter(d => !d.isPrivileged).length} hidden)
                </span>
              )}
            </h2>
            {/* Refresh button */}
            <motion.button
              onClick={() => refetch()}
              disabled={documentsLoading}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                'dark:text-white/40 text-black/40',
                'dark:hover:bg-white/10 hover:bg-black/10',
                'transition-colors duration-200'
              )}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <RefreshCw className={cn('w-4 h-4', documentsLoading && 'animate-spin')} />
            </motion.button>
          </div>

          {/* Loading state */}
          {documentsLoading && documents.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 dark:text-white/40 text-black/40 animate-spin" />
            </div>
          )}

          {/* Error state */}
          {documentsError && (
            <div className="text-center py-8 text-red-500">
              <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm">{documentsError}</p>
              <button onClick={() => refetch()} className="mt-2 text-sm underline">
                Try again
              </button>
            </div>
          )}

          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {visibleFiles.map((file, index) => (
                <FileRow
                  key={file.id}
                  file={file}
                  index={index}
                  onTogglePrivilege={() => togglePrivilege(file.id)}
                  onDelete={() => deleteFile(file.id)}
                  onContextMenu={(e) => handleContextMenu(e, file.id)}
                  globalPrivilegeMode={globalPrivilegeMode}
                />
              ))}
            </AnimatePresence>

            {!documentsLoading && !documentsError && visibleFiles.length === 0 && (
              <motion.div
                className="text-center py-12 dark:text-white/30 text-black/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {globalPrivilegeMode
                  ? 'No privileged documents. Toggle document privilege to see them here.'
                  : documents.length === 0
                    ? 'No documents yet. Drop files above to get started.'
                    : 'All documents are marked as privileged. Switch to Privileged Mode to view them.'}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu.isOpen && contextMenu.fileId && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            file={documents.find((d) => d.id === contextMenu.fileId)!}
            onTogglePrivilege={() => {
              togglePrivilege(contextMenu.fileId!)
              setContextMenu({ ...contextMenu, isOpen: false })
            }}
            onDelete={() => {
              deleteFile(contextMenu.fileId!)
              setContextMenu({ ...contextMenu, isOpen: false })
            }}
            globalPrivilegeMode={globalPrivilegeMode}
          />
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <ConfirmationDialog
            title={confirmDialog.action === 'unmark' ? 'Remove Privilege Protection?' : 'Mark as Privileged?'}
            message={
              confirmDialog.action === 'unmark'
                ? `Removing privilege protection will make "${confirmDialog.fileName}" visible in normal mode. This document may contain attorney-client privileged or work product protected information.`
                : `Mark "${confirmDialog.fileName}" as privileged? This document will only be visible in Privileged Mode.`
            }
            confirmLabel={confirmDialog.action === 'unmark' ? 'Remove Protection' : 'Mark Privileged'}
            confirmVariant={confirmDialog.action === 'unmark' ? 'danger' : 'primary'}
            onConfirm={handleConfirmPrivilegeChange}
            onCancel={() => setConfirmDialog({ isOpen: false, fileId: null, fileName: '', action: 'mark' })}
          />
        )}
      </AnimatePresence>
    </motion.main>
  )
}

function DropZone({
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const isActive = isDragOver || isHovered

  return (
    <motion.div
      className="relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Glow Effect */}
      <motion.div
        className={cn(
          'absolute inset-0 rounded-3xl',
          'bg-electric-600/20 blur-3xl',
          'pointer-events-none'
        )}
        animate={{
          opacity: isActive ? 0.8 : 0.2,
          scale: isActive ? 1.1 : 1,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      />

      {/* Drop Zone Card */}
      <motion.div
        className={cn(
          'relative z-10',
          'p-12 rounded-3xl',
          'flex flex-col items-center justify-center gap-6',
          'cursor-pointer',
          'border-2 border-dashed',
          'transition-all duration-300',
          // Border color
          isActive
            ? 'border-electric-500'
            : 'dark:border-white/20 border-black/10',
          // Background
          'dark:bg-void-card/50 bg-ceramic-card/50',
          // Shadow
          isActive
            ? 'shadow-glow-intense'
            : 'dark:shadow-none shadow-sm'
        )}
        animate={
          isActive
            ? { scale: 1.02 }
            : {
                scale: [1, 1.01, 1],
                transition: {
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }
        }
        style={
          !isActive
            ? {
                borderColor: undefined,
                animation: 'border-pulse 2s ease-in-out infinite',
              }
            : {}
        }
      >
        {/* Wireframe Cube */}
        <motion.div
          animate={{
            rotateY: isActive ? 15 : 0,
            rotateX: isActive ? -10 : 0,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <WireframeCube isActive={isActive} />
        </motion.div>

        {/* Icon */}
        <motion.div
          animate={{ y: isActive ? -5 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <Upload
            className={cn(
              'w-10 h-10',
              isActive
                ? 'text-electric-500'
                : 'dark:text-white/40 text-black/40'
            )}
            strokeWidth={2.5}
          />
        </motion.div>

        {/* Text */}
        <div className="text-center">
          <p
            className={cn(
              'text-lg font-bold',
              isActive
                ? 'text-electric-500'
                : 'dark:text-white text-black'
            )}
          >
            {isDragOver ? 'Release to Upload' : 'Feed the Box'}
          </p>
          <p className="text-sm dark:text-white/40 text-black/40 mt-1">
            Drag & drop documents or click to browse
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

function WireframeCube({ isActive }: { isActive: boolean }) {
  const strokeColor = isActive ? '#2563eb' : 'currentColor'
  const strokeOpacity = isActive ? 1 : 0.3

  return (
    <motion.svg
      width="100"
      height="100"
      viewBox="0 0 120 120"
      fill="none"
      className="dark:text-white text-black"
      animate={{
        filter: isActive
          ? 'drop-shadow(0 0 20px rgba(37, 99, 235, 0.5))'
          : 'drop-shadow(0 0 10px rgba(37, 99, 235, 0.2))',
      }}
    >
      <motion.path
        d="M30 45 L60 30 L90 45 L90 75 L60 90 L30 75 Z"
        stroke={strokeColor}
        strokeWidth={2.5}
        strokeOpacity={strokeOpacity}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ strokeOpacity }}
      />
      <motion.path
        d="M30 45 L30 75 M60 30 L60 60 M90 45 L90 75"
        stroke={strokeColor}
        strokeWidth={2.5}
        strokeOpacity={strokeOpacity}
        fill="none"
        strokeLinecap="round"
        animate={{ strokeOpacity }}
      />
      <motion.path
        d="M30 75 L60 60 L90 75 M60 60 L60 90"
        stroke={strokeColor}
        strokeWidth={2.5}
        strokeOpacity={strokeOpacity}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ strokeOpacity }}
      />
      <circle
        cx="60"
        cy="60"
        r="3"
        fill={isActive ? '#2563eb' : 'transparent'}
        opacity={isActive ? 1 : 0}
        style={{ transition: 'all 0.3s ease-out' }}
      />
    </motion.svg>
  )
}

function FileRow({
  file,
  index,
  onTogglePrivilege,
  onDelete,
  onContextMenu,
  globalPrivilegeMode,
}: {
  file: Document
  index: number
  onTogglePrivilege: () => void
  onDelete: () => void
  onContextMenu: (e: React.MouseEvent) => void
  globalPrivilegeMode: boolean
}) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getFileIcon = (type: string) => {
    if (type.includes('pdf') || type === 'pdf') return <FileText className="w-5 h-5" />
    if (type.includes('sheet') || type === 'xlsx' || type === 'xls') return <FileSpreadsheet className="w-5 h-5" />
    return <File className="w-5 h-5" />
  }

  return (
    <motion.div
      className={cn(
        'flex items-center gap-4 p-4 rounded-2xl',
        'border transition-all duration-200',
        file.isPrivileged
          ? cn(
              'dark:bg-privilege-dark/30 bg-privilege-light',
              'dark:border-privilege/30 border-privilege/20',
              'shadow-privilege'
            )
          : cn(
              'dark:bg-white/5 bg-black/5',
              'dark:border-white/10 border-black/5',
              'dark:hover:bg-white/10 hover:bg-black/10'
            )
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.05 }}
      layout
      onContextMenu={onContextMenu}
    >
      {/* File Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center',
          file.isPrivileged
            ? 'bg-privilege/20 text-privilege'
            : 'dark:bg-white/10 bg-black/10 dark:text-white/60 text-black/60'
        )}
      >
        {getFileIcon(file.type)}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'font-medium truncate',
            file.isPrivileged
              ? 'text-privilege'
              : 'dark:text-white text-black'
          )}
        >
          {file.name}
        </p>
        <div className="flex items-center gap-2 text-xs dark:text-white/40 text-black/40">
          <span>{formatSize(file.size)}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(file.uploadedAt)}
          </span>
        </div>
      </div>

      {/* Privilege Toggle */}
      <motion.button
        onClick={onTogglePrivilege}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl',
          'text-sm font-medium',
          'transition-all duration-200',
          file.isPrivileged
            ? cn(
                'bg-privilege text-white',
                'shadow-privilege'
              )
            : cn(
                'dark:bg-white/10 bg-black/10',
                'dark:text-white/60 text-black/60',
                'dark:hover:bg-white/20 hover:bg-black/20'
              )
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {file.isPrivileged ? (
          <>
            <Lock className="w-4 h-4" strokeWidth={2.5} />
            <span>Privileged</span>
          </>
        ) : (
          <>
            <Unlock className="w-4 h-4" strokeWidth={2} />
            <span>Public</span>
          </>
        )}
      </motion.button>

      {/* Delete */}
      <motion.button
        onClick={onDelete}
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          'dark:text-white/40 text-black/40',
          'dark:hover:text-white hover:text-black',
          'dark:hover:bg-white/10 hover:bg-black/10',
          'transition-colors duration-200'
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Trash2 className="w-4 h-4" />
      </motion.button>
    </motion.div>
  )
}

/**
 * Context Menu Component
 * Right-click menu for document actions
 */
function ContextMenu({
  x,
  y,
  file,
  onTogglePrivilege,
  onDelete,
  globalPrivilegeMode,
}: {
  x: number
  y: number
  file: Document
  onTogglePrivilege: () => void
  onDelete: () => void
  globalPrivilegeMode: boolean
}) {
  return (
    <motion.div
      className={cn(
        'fixed z-50 min-w-[180px]',
        'dark:bg-void-card bg-ceramic-card',
        'border dark:border-white/10 border-black/10',
        'rounded-xl shadow-lg overflow-hidden',
        'backdrop-blur-xl'
      )}
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Privilege Toggle Option */}
      <button
        onClick={onTogglePrivilege}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3',
          'text-left text-sm font-medium',
          'transition-colors duration-150',
          file.isPrivileged
            ? cn(
                'dark:text-privilege text-privilege',
                'dark:hover:bg-privilege/10 hover:bg-privilege/10'
              )
            : cn(
                'dark:text-white text-black',
                'dark:hover:bg-white/10 hover:bg-black/10'
              )
        )}
      >
        {file.isPrivileged ? (
          <>
            <Unlock className="w-4 h-4" />
            <span>Remove Privilege</span>
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            <span>Mark as Privileged</span>
          </>
        )}
      </button>

      {/* Safety warning if trying to unmark in privilege mode */}
      {file.isPrivileged && globalPrivilegeMode && (
        <div className="px-4 py-2 text-xs dark:text-amber-400/80 text-amber-600 bg-amber-500/10 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" />
          <span>Exit Privileged Mode first</span>
        </div>
      )}

      <div className="h-px dark:bg-white/10 bg-black/10" />

      {/* Delete Option */}
      <button
        onClick={onDelete}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3',
          'text-left text-sm font-medium',
          'dark:text-red-400 text-red-600',
          'dark:hover:bg-red-500/10 hover:bg-red-500/10',
          'transition-colors duration-150'
        )}
      >
        <Trash2 className="w-4 h-4" />
        <span>Delete</span>
      </button>
    </motion.div>
  )
}

/**
 * Confirmation Dialog Component
 * Modal dialog for confirming privilege changes
 */
function ConfirmationDialog({
  title,
  message,
  confirmLabel,
  confirmVariant,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  confirmVariant: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className={cn(
          'relative max-w-md w-full mx-4',
          'dark:bg-void-card bg-ceramic-card',
          'border dark:border-white/10 border-black/10',
          'rounded-2xl shadow-2xl overflow-hidden',
          'backdrop-blur-xl'
        )}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-white/10 border-black/10">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              confirmVariant === 'danger'
                ? 'bg-red-500/20 text-red-500'
                : 'bg-electric-500/20 text-electric-500'
            )}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold dark:text-white text-black">
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center dark:text-white/40 text-black/40 dark:hover:bg-white/10 hover:bg-black/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm dark:text-white/70 text-black/70 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t dark:border-white/10 border-black/10 bg-black/5 dark:bg-white/5">
          <motion.button
            onClick={onCancel}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium',
              'dark:bg-white/10 bg-black/10',
              'dark:text-white text-black',
              'dark:hover:bg-white/20 hover:bg-black/20',
              'transition-colors duration-200'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Cancel
          </motion.button>
          <motion.button
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold',
              'transition-all duration-200',
              confirmVariant === 'danger'
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                : 'bg-electric-500 text-white hover:bg-electric-600 shadow-[0_0_15px_rgba(37,99,235,0.3)]'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {confirmLabel}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
