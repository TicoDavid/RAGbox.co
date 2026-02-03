'use client'

import { useState, useCallback } from 'react'
import { Upload, Loader2, FileText, AlertCircle } from 'lucide-react'

interface TemplateUploadProps {
  onAnalysisComplete: (templateId: string) => void
}

export default function TemplateUpload({ onAnalysisComplete }: TemplateUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setFileName(file.name)
    setIsAnalyzing(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/templates/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Analysis failed' }))
        throw new Error(data.error || 'Template analysis failed')
      }

      const result = await response.json()
      onAnalysisComplete(result.templateId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }, [onAnalysisComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-[#2463EB] bg-[#2463EB]/5'
            : 'border-[#333] bg-[#0a0a0a] hover:border-[#555]'
        }`}
      >
        <input
          type="file"
          accept=".pdf,.docx,.doc,.txt,.rtf"
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isAnalyzing}
        />
        {isAnalyzing ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={24} className="text-[#2463EB] animate-spin" />
            <div className="text-xs text-[#2463EB]">Analyzing template...</div>
            {fileName && <div className="text-[10px] text-[#666]">{fileName}</div>}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={24} className="text-[#666]" />
            <div className="text-xs text-[#888]">Drop template or click to upload</div>
            <div className="text-[10px] text-[#555]">PDF, DOCX, DOC, TXT, RTF</div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-500">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {fileName && !isAnalyzing && !error && (
        <div className="flex items-center gap-2 text-xs text-[#888]">
          <FileText size={14} />
          {fileName}
        </div>
      )}
    </div>
  )
}
