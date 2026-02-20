/**
 * RAGbox Voice Server - Standalone WebSocket + HTTP Server
 *
 * Runs alongside Next.js to handle real-time voice connections.
 * In production, this can be deployed as a separate service or
 * integrated into a custom Next.js server.
 *
 * Usage:
 *   npx ts-node server/index.ts
 *   # or
 *   npm run server
 */

import http from 'http'
import { parse } from 'url'
import { startAgentWSServer } from './agent-ws'
import { handleWhatsAppWebhook } from './whatsapp/webhook'

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = parseInt(process.env.VOICE_SERVER_PORT || '3003', 10)
const HOST = process.env.VOICE_SERVER_HOST || '0.0.0.0'

// ============================================================================
// HTTP SERVER (for health checks + WebSocket upgrade)
// ============================================================================

const server = http.createServer((req, res) => {
  const { pathname } = parse(req.url || '', true)

  // CORS headers for all responses (browser fetches from app.ragbox.co)
  const allowedOrigins = process.env.ALLOWED_ORIGINS || '*'
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins)

  // Health check endpoint
  if (pathname === '/health') {
    const whatsappProvider = process.env.WHATSAPP_PROVIDER || 'vonage'
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      service: 'ragbox-voice',
      whatsapp: whatsappProvider,
      timestamp: new Date().toISOString(),
    }))
    return
  }

  // CORS preflight for WebSocket
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    })
    res.end()
    return
  }

  // Info endpoint
  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      service: 'RAGbox Voice Server',
      version: '1.0.0',
      websocket: `/agent/ws`,
      whatsapp: '/whatsapp/webhook',
      endpoints: {
        health: '/health',
        websocket: '/agent/ws?sessionId=<id>',
        whatsapp_webhook: '/whatsapp/webhook',
        whatsapp_status: '/whatsapp/webhook/status',
      },
    }))
    return
  }

  // WhatsApp webhook endpoints
  if (pathname?.startsWith('/whatsapp/webhook')) {
    handleWhatsAppWebhook(req, res)
    return
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not Found' }))
})

// ============================================================================
// WEBSOCKET SERVER
// ============================================================================

const wss = startAgentWSServer(server)

// ============================================================================
// SERVER LIFECYCLE
// ============================================================================

server.listen(PORT, HOST, () => {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  RAGbox Voice Server')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  HTTP:      http://${HOST}:${PORT}`)
  console.log(`  WebSocket: ws://${HOST}:${PORT}/agent/ws`)
  console.log(`  Health:    http://${HOST}:${PORT}/health`)
  console.log('═══════════════════════════════════════════════════════════════')
})

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n[Server] Received ${signal}, shutting down...`)

  // Close WebSocket server
  wss.close(() => {
    console.log('[Server] WebSocket server closed')
  })

  // Close HTTP server
  server.close(() => {
    console.log('[Server] HTTP server closed')
    process.exit(0)
  })

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout')
    process.exit(1)
  }, 10_000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught exception:', error)
  shutdown('uncaughtException')
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled rejection at:', promise, 'reason:', reason)
})

export { server, wss }
