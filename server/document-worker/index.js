/**
 * RAGbox Document Processing Worker
 *
 * Pulls messages from Pub/Sub, processes documents through:
 *   1. Download from GCS
 *   2. Document AI text extraction
 *   3. Semantic chunking
 *   4. Vertex AI embedding (with failover + exponential backoff)
 *   5. pgvector storage
 *   6. Document status update
 */

'use strict';

const { PubSub } = require('@google-cloud/pubsub');
const { Storage } = require('@google-cloud/storage');
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
const { PredictionServiceClient } = require('@google-cloud/aiplatform');
const { Pool } = require('pg');
const crypto = require('crypto');

// ============================================================================
// Configuration
// ============================================================================

const GCP_PROJECT = process.env.GCP_PROJECT || 'ragbox-sovereign-prod';
const PUBSUB_SUBSCRIPTION = process.env.PUBSUB_SUBSCRIPTION || 'ragbox-document-worker-sub';
const DOC_AI_LOCATION = process.env.DOCUMENT_AI_LOCATION || 'us';
const DOC_AI_PROCESSOR_ID = process.env.DOCUMENT_AI_PROCESSOR_ID || '610ba2535700c5de';
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMENSION = 768;
const MAX_CHUNK_TOKENS = 500;
const OVERLAP_SENTENCES = 2;

// Exponential backoff delays (ms)
const BACKOFF_DELAYS = [10000, 30000, 60000, 120000, 300000];
const MAX_RETRIES = BACKOFF_DELAYS.length;

// ============================================================================
// Clients
// ============================================================================

const pubsub = new PubSub({ projectId: GCP_PROJECT });
const storage = new Storage();
const docaiClient = new DocumentProcessorServiceClient({
  apiEndpoint: `${DOC_AI_LOCATION}-documentai.googleapis.com`,
});

const aiplatformClient = new PredictionServiceClient({
  apiEndpoint: 'us-central1-aiplatform.googleapis.com',
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('[Worker] Starting RAGbox Document Processing Worker');
  console.log(`[Worker] Project: ${GCP_PROJECT}`);
  console.log(`[Worker] Subscription: ${PUBSUB_SUBSCRIPTION}`);

  // Verify DB connection
  try {
    const res = await pool.query('SELECT 1');
    console.log('[Worker] Database connection OK');
  } catch (err) {
    console.error('[Worker] Database connection FAILED:', err.message);
    process.exit(1);
  }

  const subscription = pubsub.subscription(PUBSUB_SUBSCRIPTION, {
    flowControl: {
      maxMessages: 5,       // Process up to 5 docs concurrently
      allowExcessMessages: false,
    },
  });

  subscription.on('message', handleMessage);
  subscription.on('error', (err) => {
    console.error('[Worker] Subscription error:', err.message);
  });

  console.log('[Worker] Listening for messages...');

  // Graceful shutdown
  const shutdown = () => {
    console.log('[Worker] Shutting down...');
    subscription.close().then(() => {
      pool.end().then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// ============================================================================
// Message Handler
// ============================================================================

async function handleMessage(message) {
  let data;
  try {
    data = JSON.parse(message.data.toString());
  } catch (err) {
    console.error('[Worker] Invalid message JSON — acking to discard:', err.message);
    message.ack();
    return;
  }

  const { documentId, userId, bucketName, objectPath, originalName, mimeType } = data;
  console.log(`[Worker] Processing document: ${documentId} (${originalName})`);

  const client = await pool.connect();
  try {
    // 0. Check if already indexed (idempotent — skip if Go backend already processed)
    const statusCheck = await client.query(
      `SELECT index_status FROM documents WHERE id = $1`,
      [documentId]
    );
    if (statusCheck.rows.length > 0 && statusCheck.rows[0].index_status === 'Indexed') {
      console.log(`[Worker] Document ${documentId} already Indexed — skipping`);
      message.ack();
      client.release();
      return;
    }

    // 1. Set status to Processing
    await client.query(
      `UPDATE documents SET index_status = 'Processing', updated_at = NOW() WHERE id = $1`,
      [documentId]
    );

    // 2. Download from GCS
    const fileBuffer = await downloadFromGCS(bucketName, objectPath);
    console.log(`[Worker] Downloaded ${fileBuffer.length} bytes from gs://${bucketName}/${objectPath}`);

    // 3. Extract text via Document AI
    const extractedText = await extractText(fileBuffer, mimeType);
    console.log(`[Worker] Extracted ${extractedText.length} characters`);

    if (!extractedText.trim()) {
      await client.query(
        `UPDATE documents SET index_status = 'Failed', extracted_text = '', updated_at = NOW() WHERE id = $1`,
        [documentId]
      );
      console.warn(`[Worker] No text extracted from ${documentId} — marked as Failed`);
      message.ack();
      return;
    }

    // Store extracted text
    await client.query(
      `UPDATE documents SET extracted_text = $1, updated_at = NOW() WHERE id = $2`,
      [extractedText, documentId]
    );

    // 4. Chunk the text
    const chunks = semanticChunk(extractedText, MAX_CHUNK_TOKENS, OVERLAP_SENTENCES);
    console.log(`[Worker] Created ${chunks.length} chunks`);

    // 5. Generate embeddings (with failover)
    const embeddings = await generateEmbeddingsBatch(chunks.map(c => c.text));
    console.log(`[Worker] Generated ${embeddings.length} embeddings`);

    // 6. Delete old chunks if re-processing
    await client.query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);

    // 7. Store chunks + embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${documentId}_chunk_${i}`;
      const contentHash = crypto.createHash('sha256').update(chunks[i].text).digest('hex');
      await client.query(
        `INSERT INTO document_chunks (id, document_id, chunk_index, content, content_hash, token_count, embedding, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::vector, NOW())
         ON CONFLICT (id) DO UPDATE SET
           content = EXCLUDED.content,
           content_hash = EXCLUDED.content_hash,
           token_count = EXCLUDED.token_count,
           embedding = EXCLUDED.embedding`,
        [chunkId, documentId, i, chunks[i].text, contentHash, chunks[i].tokenCount, `[${embeddings[i].join(',')}]`]
      );
    }

    // 8. Update document status to Indexed
    await client.query(
      `UPDATE documents SET index_status = 'Indexed', chunk_count = $1, updated_at = NOW() WHERE id = $2`,
      [chunks.length, documentId]
    );

    console.log(`[Worker] Document ${documentId} indexed successfully (${chunks.length} chunks)`);
    message.ack();
  } catch (err) {
    console.error(`[Worker] Failed to process ${documentId}:`, err.message);

    // Mark as Failed in DB
    try {
      await client.query(
        `UPDATE documents SET index_status = 'Failed', updated_at = NOW() WHERE id = $1`,
        [documentId]
      );
    } catch (dbErr) {
      console.error(`[Worker] Could not update status to Failed:`, dbErr.message);
    }

    // Nack for Pub/Sub redelivery (up to max-delivery-attempts before DLQ)
    message.nack();
  } finally {
    client.release();
  }
}

// ============================================================================
// GCS Download
// ============================================================================

async function downloadFromGCS(bucketName, objectPath) {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath);
  const [buffer] = await file.download();
  return buffer;
}

// ============================================================================
// Document AI Text Extraction
// ============================================================================

async function extractText(fileBuffer, mimeType) {
  const processorName = `projects/${GCP_PROJECT}/locations/${DOC_AI_LOCATION}/processors/${DOC_AI_PROCESSOR_ID}`;

  const request = {
    name: processorName,
    rawDocument: {
      content: fileBuffer.toString('base64'),
      mimeType: mimeType || 'application/pdf',
    },
  };

  const [result] = await docaiClient.processDocument(request);
  return result.document?.text || '';
}

// ============================================================================
// Semantic Chunking
// ============================================================================

function semanticChunk(text, maxTokens, overlapSentences) {
  // Split into paragraphs first, then sentences
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim());
  const chunks = [];
  let currentChunk = '';
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    // If paragraph alone exceeds max, split by sentences
    if (paraTokens > maxTokens) {
      if (currentChunk.trim()) {
        chunks.push({ text: currentChunk.trim(), tokenCount: currentTokens });
        currentChunk = '';
        currentTokens = 0;
      }

      const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
      for (const sentence of sentences) {
        const sentTokens = estimateTokens(sentence);
        if (currentTokens + sentTokens > maxTokens && currentChunk.trim()) {
          chunks.push({ text: currentChunk.trim(), tokenCount: currentTokens });

          // Overlap: keep last N sentences
          const prevSentences = currentChunk.match(/[^.!?]+[.!?]+/g) || [];
          const overlap = prevSentences.slice(-overlapSentences).join(' ');
          currentChunk = overlap ? overlap + ' ' + sentence : sentence;
          currentTokens = estimateTokens(currentChunk);
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
          currentTokens += sentTokens;
        }
      }
    } else if (currentTokens + paraTokens > maxTokens) {
      // Flush current chunk
      chunks.push({ text: currentChunk.trim(), tokenCount: currentTokens });

      // Overlap: keep last N sentences from previous chunk
      const prevSentences = currentChunk.match(/[^.!?]+[.!?]+/g) || [];
      const overlap = prevSentences.slice(-overlapSentences).join(' ');
      currentChunk = overlap ? overlap + '\n\n' + para : para;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
      currentTokens += paraTokens;
    }
  }

  // Flush remaining
  if (currentChunk.trim()) {
    chunks.push({ text: currentChunk.trim(), tokenCount: currentTokens });
  }

  return chunks;
}

function estimateTokens(text) {
  // Rough estimate: ~4 chars per token for English
  return Math.ceil(text.length / 4);
}

// ============================================================================
// Vertex AI Embeddings (with exponential backoff)
// ============================================================================

async function generateEmbeddingsBatch(texts) {
  const BATCH_SIZE = 5;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await generateEmbeddingsWithRetry(batch);
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

async function generateEmbeddingsWithRetry(texts, retryCount = 0) {
  try {
    const endpoint = `projects/${GCP_PROJECT}/locations/us-central1/publishers/google/models/${EMBEDDING_MODEL}`;
    const instances = texts.map(text => ({
      structValue: {
        fields: {
          content: { stringValue: text },
        },
      },
    }));

    const [response] = await aiplatformClient.predict({
      endpoint,
      instances,
    });

    return response.predictions.map(pred => {
      const values = pred.structValue.fields.embeddings.structValue.fields.values.listValue.values;
      return values.map(v => v.numberValue);
    });
  } catch (error) {
    const code = error.code || error.statusCode || 0;
    if ((code === 8 || code === 429 || code >= 500) && retryCount < MAX_RETRIES) {
      const delay = BACKOFF_DELAYS[retryCount];
      console.log(`[Worker] Embedding API error ${code} — retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms`);
      await sleep(delay);
      return generateEmbeddingsWithRetry(texts, retryCount + 1);
    }

    console.error(`[Worker] Embedding failed after ${retryCount} retries:`, error.message);
    throw error;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Health check HTTP server (required by Cloud Run)
// ============================================================================

const http = require('http');
const PORT = process.env.PORT || 8080;
let isHealthy = false;

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(isHealthy ? 200 : 503);
    res.end(isHealthy ? 'OK' : 'Starting');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// ============================================================================
// Start
// ============================================================================

server.listen(PORT, () => {
  console.log(`[Worker] Health server listening on port ${PORT}`);
  main().then(() => {
    isHealthy = true;
  }).catch(err => {
    console.error('[Worker] Fatal error:', err);
    process.exit(1);
  });
});
