/**
 * Vertex AI Embeddings Client - RAGbox.co
 *
 * Generates text embeddings using text-embedding-005 (768 dimensions).
 */

import { VertexAI } from '@google-cloud/vertexai'

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'ragbox-sovereign-prod'
const LOCATION = process.env.GCP_LOCATION || 'us-east4'
const EMBEDDING_MODEL = 'text-embedding-005'
const EMBEDDING_DIMENSIONS = 768
const MAX_BATCH_SIZE = 250

let vertexAI: VertexAI

function getVertexAI(): VertexAI {
  if (!vertexAI) {
    vertexAI = new VertexAI({
      project: PROJECT_ID,
      location: LOCATION,
    })
  }
  return vertexAI
}

export interface EmbeddingResult {
  embedding: number[]
  tokenCount: number
}

/**
 * Generate embedding for a single text
 */
export async function embedText(text: string): Promise<EmbeddingResult> {
  const results = await embedBatch([text])
  return results[0]
}

/**
 * Generate embeddings for a batch of texts
 */
export async function embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return []

  const ai = getVertexAI()
  const results: EmbeddingResult[] = []

  // Process in batches of MAX_BATCH_SIZE
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE)

    try {
      const model = ai.getGenerativeModel({ model: EMBEDDING_MODEL })

      // Use the embedding endpoint via the Vertex AI REST API
      const response = await fetch(
        `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${EMBEDDING_MODEL}:predict`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getAccessToken()}`,
          },
          body: JSON.stringify({
            instances: batch.map(text => ({
              content: text,
              task_type: 'RETRIEVAL_DOCUMENT',
            })),
            parameters: {
              outputDimensionality: EMBEDDING_DIMENSIONS,
            },
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Embedding API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const predictions = data.predictions || []

      for (const prediction of predictions) {
        results.push({
          embedding: prediction.embeddings.values,
          tokenCount: prediction.embeddings.statistics?.token_count || 0,
        })
      }
    } catch (error) {
      // Fill failed entries with empty results
      for (let j = 0; j < batch.length; j++) {
        results.push({ embedding: [], tokenCount: 0 })
      }
    }
  }

  return results
}

/**
 * Generate query embedding (uses RETRIEVAL_QUERY task type)
 */
export async function embedQuery(text: string): Promise<number[]> {
  try {
    const response = await fetch(
      `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${EMBEDDING_MODEL}:predict`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({
          instances: [{ content: text, task_type: 'RETRIEVAL_QUERY' }],
          parameters: {
            outputDimensionality: EMBEDDING_DIMENSIONS,
          },
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Query embedding failed: ${response.status}`)
    }

    const data = await response.json()
    return data.predictions[0].embeddings.values
  } catch (error) {
    throw error
  }
}

/**
 * Get access token for Vertex AI API
 */
async function getAccessToken(): Promise<string> {
  // Use Google Auth Library for service account credentials
  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    ...(process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS }
      : {}),
  })
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()
  return tokenResponse.token || ''
}

export const EMBEDDING_DIMENSIONS_COUNT = EMBEDDING_DIMENSIONS
