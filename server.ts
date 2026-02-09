/**
 * RAGbox Unified Server
 *
 * Single server on port 3000 that handles:
 * - Next.js pages and API routes
 * - WebSocket connections for voice agent
 * - Health checks
 *
 * Usage:
 *   npm run dev:unified   # Development
 *   npm run start:unified # Production
 */

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { startAgentWSServer } from './server/agent-ws'

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = process.env.HOST || 'localhost'
const dev = process.env.NODE_ENV !== 'production'

// ============================================================================
// NEXT.JS APP
// ============================================================================

const app = next({ dev, hostname: HOST, port: PORT })
const handle = app.getRequestHandler()

// ============================================================================
// START SERVER
// ============================================================================

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '', true)

    // Health check endpoint (bypasses Next.js)
    if (parsedUrl.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: 'ok',
        service: 'ragbox',
        timestamp: new Date().toISOString(),
        websocket: '/agent/ws',
      }))
      return
    }

    // Let Next.js handle everything else
    handle(req, res, parsedUrl)
  })

  // Attach WebSocket server to the same HTTP server
  const wss = startAgentWSServer(server)

  server.listen(PORT, () => {
    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('  RAGbox.co - Unified Server')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`  URL:        http://${HOST}:${PORT}`)
    console.log(`  WebSocket:  ws://${HOST}:${PORT}/agent/ws`)
    console.log(`  Health:     http://${HOST}:${PORT}/health`)
    console.log(`  Mode:       ${dev ? 'development' : 'production'}`)
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
  })

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\n[Server] ${signal} received, shutting down...`)
    wss.close()
    server.close(() => {
      console.log('[Server] Closed')
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
})
