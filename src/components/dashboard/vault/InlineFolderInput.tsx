'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Folder } from 'lucide-react'

interface InlineFolderInputProps {
  parentId?: string
  existingNames: string[]
  defaultName?: string
  onSubmit: (name: string) => void
  onCancel: () => void
}

export function InlineFolderInput({ existingNames, defaultName, onSubmit, onCancel }: InlineFolderInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(defaultName ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const validate = (name: string): string | null => {
    const trimmed = name.trim()
    if (!trimmed) return 'Name cannot be empty'
    if (trimmed.length > 100) return 'Max 100 characters'
    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      return 'A folder with this name already exists'
    }
    return null
  }

  const handleSubmit = () => {
    const trimmed = value.trim()
    const err = validate(trimmed)
    if (err) {
      setError(err)
      return
    }
    onSubmit(trimmed)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <Folder className="w-4 h-4 text-[var(--warning)] shrink-0" />
      <div className="flex-1 min-w-0">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') onCancel()
          }}
          onBlur={() => {
            if (value.trim()) handleSubmit()
            else onCancel()
          }}
          placeholder="Folder name"
          className="w-full bg-transparent border-b border-[var(--brand-blue)] outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          maxLength={100}
        />
        {error && (
          <p className="text-[10px] text-[var(--danger)] mt-0.5">{error}</p>
        )}
      </div>
    </div>
  )
}
