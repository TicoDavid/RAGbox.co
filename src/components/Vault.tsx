'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  File,
  FileText,
  Lock,
  Unlock,
  Trash2,
  MoreVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRagSounds } from '@/hooks/useRagSounds'

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: Date
  isPrivileged: boolean
}

// Demo files for UI
const demoFiles: UploadedFile[] = [
  {
    id: '1',
    name: 'Contract_NDA_2024.pdf',
    size: 2450000,
    type: 'application/pdf',
    uploadedAt: new Date(),
    isPrivileged: false,
  },
  {
    id: '2',
    name: 'Financial_Statement_Q4.xlsx',
    size: 1200000,
    type: 'application/excel',
    uploadedAt: new Date(),
    isPrivileged: true,
  },
  {
    id: '3',
    name: 'Legal_Brief_v3.docx',
    size: 890000,
    type: 'application/word',
    uploadedAt: new Date(),
    isPrivileged: false,
  },
]

/**
 * Vault Component - Center Stage
 *
 * Features:
 * - "Feed the Box" drop zone with Electric Blue glow
 * - File list with Privilege Mode toggle (Grey -> Red)
 * - Wireframe cube animation
 */
export function Vault() {
  const [files, setFiles] = useState<UploadedFile[]>(demoFiles)
  const [isDragOver, setIsDragOver] = useState(false)

  // Audio UI - The "RAG" sounds
  const { playLockSound, playDropSound } = useRagSounds()

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

      const newFiles: UploadedFile[] = droppedFiles.map((file) => ({
        id: Date.now().toString() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date(),
        isPrivileged: false,
      }))

      setFiles((prev) => [...newFiles, ...prev])
    }
  }, [playDropSound])

  const togglePrivilege = (id: string) => {
    // AUDIO UI: Play metallic deadbolt click
    playLockSound()

    setFiles((prev) =>
      prev.map((file) =>
        file.id === id ? { ...file, isPrivileged: !file.isPrivileged } : file
      )
    )
  }

  const deleteFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id))
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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-3xl font-extrabold dark:text-white text-black">
            The Box
          </h1>
          <p className="text-sm dark:text-white/40 text-black/40 mt-1">
            Feed your documents. Interrogate with confidence.
          </p>
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
              Documents ({files.length})
            </h2>
          </div>

          <div className="space-y-2">
            <AnimatePresence>
              {files.map((file, index) => (
                <FileRow
                  key={file.id}
                  file={file}
                  index={index}
                  onTogglePrivilege={() => togglePrivilege(file.id)}
                  onDelete={() => deleteFile(file.id)}
                />
              ))}
            </AnimatePresence>

            {files.length === 0 && (
              <motion.div
                className="text-center py-12 dark:text-white/30 text-black/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                No documents yet. Drop files above to get started.
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
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
}: {
  file: UploadedFile
  index: number
  onTogglePrivilege: () => void
  onDelete: () => void
}) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="w-5 h-5" />
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
        <p className="text-xs dark:text-white/40 text-black/40">
          {formatSize(file.size)}
        </p>
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
