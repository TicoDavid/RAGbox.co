/**
 * Sovereign Studio - Artifact Generator
 *
 * Main orchestrator for generating artifacts from vault documents.
 */

import { ragClient } from '@/lib/vertex/rag-client'
import { storageClient } from '@/lib/gcp/storage-client'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { prisma } from '@/lib/prisma'
import { deletion_status } from '@prisma/client'
import { buildGenerationPrompt, getSystemPromptForArtifact } from './prompts'
import type {
  ArtifactType,
  GenerationRequest,
  GenerationResult,
  NarrationScript,
  DeckStructure,
  MindMapStructure,
  ComplianceDrill,
  EvidenceLog,
} from './types'
import { renderReport } from './renderers/renderReport'
import { renderDeck } from './renderers/renderDeck'
import { renderEvidence } from './renderers/renderEvidence'

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'ragbox-documents-prod'

// Initialize TTS client for audio generation
let ttsClient: TextToSpeechClient | null = null
function getTTSClient(): TextToSpeechClient {
  if (!ttsClient) {
    ttsClient = new TextToSpeechClient()
  }
  return ttsClient
}

/**
 * Fetch document content from vault
 */
async function fetchDocumentContent(documentIds: string[], userId: string): Promise<string> {
  const documents = await prisma.document.findMany({
    where: {
      id: { in: documentIds },
      userId,
      deletionStatus: deletion_status.Active,
    },
    select: {
      id: true,
      originalName: true,
      extractedText: true,
    },
  })

  if (documents.length === 0) {
    throw new Error('No accessible documents found')
  }

  // Combine document content with source attribution
  return documents
    .map((doc) => `[Source: ${doc.originalName}]\n${doc.extractedText || '[No text extracted]'}`)
    .join('\n\n---\n\n')
}

/**
 * Generate artifact content using Vertex AI
 */
async function generateArtifactContent(
  artifactType: ArtifactType,
  documentContent: string,
  request: GenerationRequest
): Promise<string> {
  const prompt = buildGenerationPrompt(
    artifactType,
    documentContent,
    request.brandConfig.tone,
    request.title,
    request.additionalInstructions
  )

  const systemPrompt = getSystemPromptForArtifact(artifactType, request.brandConfig.tone)

  const response = await ragClient.chat(prompt, { systemPrompt })
  return response.answer
}

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
function parseAIResponse<T>(content: string): T {
  // Remove markdown code blocks if present
  let cleanContent = content.trim()
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.slice(7)
  } else if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.slice(3)
  }
  if (cleanContent.endsWith('```')) {
    cleanContent = cleanContent.slice(0, -3)
  }
  return JSON.parse(cleanContent.trim())
}

/**
 * Generate audio from script using Google Cloud TTS
 */
async function generateAudio(script: NarrationScript): Promise<Buffer> {
  const tts = getTTSClient()

  // Combine all text into narration
  const fullText = [
    script.introduction,
    ...script.sections.map((s) => `${s.sectionTitle}. ${s.content}`),
    script.conclusion,
  ].join('\n\n')

  // Limit to TTS max (5000 chars per request)
  const chunks: string[] = []
  let remaining = fullText
  while (remaining.length > 0) {
    if (remaining.length <= 4500) {
      chunks.push(remaining)
      break
    }
    // Find last sentence break before 4500 chars
    const cutoff = remaining.lastIndexOf('. ', 4500)
    if (cutoff > 0) {
      chunks.push(remaining.slice(0, cutoff + 1))
      remaining = remaining.slice(cutoff + 2)
    } else {
      chunks.push(remaining.slice(0, 4500))
      remaining = remaining.slice(4500)
    }
  }

  // Generate audio for each chunk
  const audioBuffers: Buffer[] = []
  for (const chunk of chunks) {
    const [response] = await tts.synthesizeSpeech({
      input: { text: chunk },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Neural2-D', // Professional male voice
        ssmlGender: 'MALE',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.95,
        pitch: -1.0,
        effectsProfileId: ['small-bluetooth-speaker-class-device'],
      },
    })

    if (response.audioContent) {
      audioBuffers.push(Buffer.from(response.audioContent as Uint8Array))
    }
  }

  // Concatenate audio buffers (simple MP3 concatenation)
  return Buffer.concat(audioBuffers)
}

/**
 * Generate Mermaid.js diagram for mind map
 */
function generateMermaidDiagram(mindmap: MindMapStructure): string {
  const lines: string[] = ['mindmap', `  root((${mindmap.root.label}))`]

  function addNodes(node: typeof mindmap.root, depth: number) {
    const indent = '  '.repeat(depth + 1)
    for (const child of node.children || []) {
      lines.push(`${indent}${child.label}`)
      if (child.children && child.children.length > 0) {
        addNodes(child, depth + 1)
      }
    }
  }

  addNodes(mindmap.root, 1)
  return lines.join('\n')
}

/**
 * Generate PowerPoint XML structure (simplified - returns JSON for frontend rendering)
 */
function generateDeckJSON(deck: DeckStructure): string {
  return JSON.stringify(deck, null, 2)
}

/**
 * Generate Excel-compatible CSV for evidence log
 */
function generateEvidenceCSV(log: EvidenceLog): string {
  const headers = ['ID', 'Document Source', 'Excerpt', 'Category', 'Significance', 'Page Reference', 'Notes']
  const rows = log.entries.map((e) => [
    e.id,
    `"${e.documentSource.replace(/"/g, '""')}"`,
    `"${e.excerpt.replace(/"/g, '""')}"`,
    e.category,
    e.significance,
    e.pageReference || '',
    `"${(e.notes || '').replace(/"/g, '""')}"`,
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

/**
 * Upload artifact to GCS and return download URL
 */
async function uploadArtifact(
  content: Buffer | string,
  fileName: string,
  mimeType: string,
  userId: string
): Promise<{ gcsUri: string; downloadUrl: string }> {
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content
  const destination = `users/${userId}/artifacts/${Date.now()}-${fileName}`

  const result = await storageClient.uploadFile(buffer, destination, mimeType, userId)

  // Get signed URL for download (valid for 24 hours)
  const downloadUrl = await storageClient.getSignedUrl(result.gcsUri, 60 * 24)

  return {
    gcsUri: result.gcsUri,
    downloadUrl,
  }
}

/**
 * Main artifact generation function
 */
export async function generateArtifact(
  request: GenerationRequest,
  userId: string
): Promise<GenerationResult> {
  const startTime = Date.now()

  // 1. Fetch document content
  const documentContent = await fetchDocumentContent(request.sourceDocumentIds, userId)

  // 2. Generate artifact content with AI
  const aiContent = await generateArtifactContent(request.artifactType, documentContent, request)

  // 3. Process based on artifact type
  let finalContent: Buffer | string
  let fileName: string
  let fileType: string
  let mimeType: string
  let previewContent: string | undefined

  const timestamp = new Date().toISOString().split('T')[0]
  const safeName = (request.title || request.artifactType).replace(/[^a-zA-Z0-9]/g, '_')

  switch (request.artifactType) {
    case 'audio': {
      const script = parseAIResponse<NarrationScript>(aiContent)
      finalContent = await generateAudio(script)
      fileName = `${safeName}_Audio_${timestamp}.mp3`
      fileType = 'mp3'
      mimeType = 'audio/mpeg'
      previewContent = script.introduction.substring(0, 500)
      break
    }

    case 'video': {
      // For video, we generate the script JSON (frontend will create the video)
      const script = parseAIResponse<NarrationScript>(aiContent)
      finalContent = JSON.stringify(script, null, 2)
      fileName = `${safeName}_Video_Script_${timestamp}.json`
      fileType = 'json'
      mimeType = 'application/json'
      previewContent = script.introduction.substring(0, 500)
      break
    }

    case 'mindmap': {
      const mindmap = parseAIResponse<MindMapStructure>(aiContent)
      const mermaid = generateMermaidDiagram(mindmap)
      finalContent = JSON.stringify({ ...mindmap, mermaidCode: mermaid }, null, 2)
      fileName = `${safeName}_MindMap_${timestamp}.json`
      fileType = 'json'
      mimeType = 'application/json'
      previewContent = mermaid
      break
    }

    case 'report': {
      // Report: Markdown → DOCX
      finalContent = await renderReport(aiContent)
      fileName = `${safeName}_Report_${timestamp}.docx`
      fileType = 'docx'
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      previewContent = aiContent.substring(0, 1000)
      break
    }

    case 'compliance': {
      const drill = parseAIResponse<ComplianceDrill>(aiContent)
      finalContent = JSON.stringify(drill, null, 2)
      fileName = `${safeName}_Compliance_Drill_${timestamp}.json`
      fileType = 'json'
      mimeType = 'application/json'
      previewContent = `${drill.cards.length} flashcards, ${drill.quiz.length} quiz questions`
      break
    }

    case 'infographic': {
      // Infographic data for frontend rendering
      finalContent = aiContent
      fileName = `${safeName}_Infographic_${timestamp}.json`
      fileType = 'json'
      mimeType = 'application/json'
      previewContent = aiContent.substring(0, 500)
      break
    }

    case 'deck': {
      const deck = parseAIResponse<DeckStructure>(aiContent)
      finalContent = await renderDeck(deck)
      fileName = `${safeName}_Deck_${timestamp}.pptx`
      fileType = 'pptx'
      mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      previewContent = `${deck.slides.length} slides: ${deck.title}`
      break
    }

    case 'evidence': {
      const log = parseAIResponse<EvidenceLog>(aiContent)
      finalContent = await renderEvidence(log)
      fileName = `${safeName}_Evidence_Log_${timestamp}.xlsx`
      fileType = 'xlsx'
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      previewContent = log.summary
      break
    }

    default:
      throw new Error(`Unknown artifact type: ${request.artifactType}`)
  }

  // 4. Upload to GCS
  const { gcsUri, downloadUrl } = await uploadArtifact(finalContent, fileName, mimeType, userId)

  // 5. Record artifact in database (if table exists)
  const artifactId = `art_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

  const processingTimeMs = Date.now() - startTime

  return {
    success: true,
    artifactId,
    fileName,
    fileType,
    mimeType,
    downloadUrl,
    previewContent,
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceDocuments: request.sourceDocumentIds.length,
      tone: request.brandConfig.tone,
      processingTimeMs,
    },
  }
}
