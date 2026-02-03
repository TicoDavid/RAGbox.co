'use client'

import { useState, useCallback } from 'react'
import { X, Hammer, Loader2, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import TemplateLibrary from './TemplateLibrary'
import TemplateUpload from './TemplateUpload'
import TemplatePreview from './TemplatePreview'
import type { TemplateAnalysis } from '@/types/templateAnalysis'

interface TemplateSelectorProps {
  sourceContext: string
  onClose: () => void
}

type Step = 'select' | 'upload' | 'fill' | 'generating' | 'done' | 'error'

export default function TemplateSelector({ sourceContext, onClose }: TemplateSelectorProps) {
  const [step, setStep] = useState<Step>('select')
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateAnalysis | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleTemplateSelect = useCallback((template: TemplateAnalysis) => {
    setSelectedTemplate(template)
    // Pre-fill default values
    const defaults: Record<string, string> = {}
    for (const field of template.fields) {
      if (field.defaultValue) {
        defaults[field.name] = field.defaultValue
      }
    }
    setFieldValues(defaults)
    setStep('fill')
  }, [])

  const handleAnalysisComplete = useCallback(async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates?id=${templateId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.template) {
          handleTemplateSelect(data.template)
        }
      }
    } catch {
      setErrorMessage('Failed to load analyzed template')
      setStep('error')
    }
  }, [handleTemplateSelect])

  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldName]: value }))
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate) return

    setStep('generating')
    setErrorMessage(null)

    try {
      const response = await fetch('/api/forge/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.templateId,
          templateName: selectedTemplate.name,
          category: selectedTemplate.category,
          fields: selectedTemplate.fields,
          fieldValues,
          sourceContext,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Generation failed' }))
        throw new Error(data.error || 'Document generation failed')
      }

      const result = await response.json()
      setGeneratedUrl(result.downloadUrl || null)
      setStep('done')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Generation failed')
      setStep('error')
    }
  }, [selectedTemplate, fieldValues, sourceContext])

  const handleDownload = useCallback(() => {
    if (generatedUrl) {
      const a = document.createElement('a')
      a.href = generatedUrl
      a.download = `${selectedTemplate?.name || 'document'}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }, [generatedUrl, selectedTemplate])

  const requiredMissing = selectedTemplate?.fields
    .filter(f => f.required && !fieldValues[f.name]?.trim())
    .length || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl border border-[#222] bg-[#0a0a0a] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-[#222] bg-[#0a0a0a]">
          <div className="flex items-center gap-2">
            <Hammer size={18} className="text-[#2463EB]" />
            <span className="text-sm font-semibold text-white">FORGE Document</span>
          </div>
          <button onClick={onClose} className="text-[#666] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {step === 'select' && (
            <TemplateLibrary
              onSelect={handleTemplateSelect}
              selectedTemplateId={selectedTemplate?.templateId}
              onUploadClick={() => setStep('upload')}
            />
          )}

          {step === 'upload' && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('select')}
                className="text-[10px] text-[#2463EB] hover:underline"
              >
                Back to library
              </button>
              <TemplateUpload onAnalysisComplete={handleAnalysisComplete} />
            </div>
          )}

          {step === 'fill' && selectedTemplate && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('select')}
                className="text-[10px] text-[#2463EB] hover:underline"
              >
                Change template
              </button>
              <TemplatePreview
                template={selectedTemplate}
                fieldValues={fieldValues}
                onFieldChange={handleFieldChange}
              />
              <button
                onClick={handleGenerate}
                disabled={requiredMissing > 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium text-black bg-[#2463EB] hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
              >
                <Hammer size={14} />
                {requiredMissing > 0
                  ? `${requiredMissing} required field${requiredMissing > 1 ? 's' : ''} missing`
                  : 'Forge Document'}
              </button>
            </div>
          )}

          {step === 'generating' && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 size={32} className="text-[#2463EB] animate-spin" />
              <div className="text-sm text-white">Forging document...</div>
              <div className="text-[10px] text-[#666]">Generating from template with AI</div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-12">
              <CheckCircle2 size={32} className="text-green-500" />
              <div className="text-sm text-white">Document forged successfully</div>
              {generatedUrl && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-black bg-[#2463EB] hover:bg-[#1D4ED8] transition-colors"
                >
                  <Download size={14} />
                  Download
                </button>
              )}
              <button
                onClick={onClose}
                className="text-[10px] text-[#666] hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center gap-3 py-12">
              <AlertCircle size={32} className="text-red-500" />
              <div className="text-sm text-red-400">{errorMessage || 'Something went wrong'}</div>
              <button
                onClick={() => setStep(selectedTemplate ? 'fill' : 'select')}
                className="text-xs text-[#2463EB] hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
