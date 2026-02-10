import { DocumentProcessorServiceClient } from '@google-cloud/documentai'

// Note: In production, configure processor name via environment variables
const projectId = process.env.GOOGLE_CLOUD_PROJECT
const location = process.env.GCP_REGION || 'us'
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID

let client: DocumentProcessorServiceClient | null = null

function getClient(): DocumentProcessorServiceClient {
  if (!client) {
    client = new DocumentProcessorServiceClient()
  }
  return client
}

async function extractTextFromPdf(gcsUri: string): Promise<string> {
  if (!projectId || !processorId) {
    console.warn('[DocumentAI] Not configured - returning empty text')
    return ''
  }

  const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`

  const request = {
    name: processorName,
    gcsDocument: {
      gcsUri,
      mimeType: 'application/pdf',
    },
  }

  try {
    const [result] = await getClient().processDocument(request)
    return result.document?.text || ''
  } catch (error) {
    console.error('[DocumentAI] Failed to process PDF:', error)
    return ''
  }
}

async function extractTextFromImage(gcsUri: string): Promise<string> {
  if (!projectId || !processorId) {
    console.warn('[DocumentAI] Not configured - returning empty text')
    return ''
  }

  const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`

  const request = {
    name: processorName,
    gcsDocument: {
      gcsUri,
      mimeType: 'image/jpeg',
    },
  }

  try {
    const [result] = await getClient().processDocument(request)
    return result.document?.text || ''
  } catch (error) {
    console.error('[DocumentAI] Failed to process image:', error)
    return ''
  }
}

export { extractTextFromPdf, extractTextFromImage }