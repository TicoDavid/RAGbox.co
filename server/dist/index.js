"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wss = exports.server = void 0;
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
const agent_ws_1 = require("./agent-ws");
const webhook_1 = require("./whatsapp/webhook");
// ============================================================================
// CONFIGURATION
// ============================================================================
const PORT = parseInt(process.env.VOICE_SERVER_PORT || '3003', 10);
const HOST = process.env.VOICE_SERVER_HOST || '0.0.0.0';
// ============================================================================
// HTTP SERVER (for health checks + WebSocket upgrade)
// ============================================================================
const server = http_1.default.createServer((req, res) => {
    const { pathname } = (0, url_1.parse)(req.url || '', true);
    // CORS headers for all responses (browser fetches from app.ragbox.co)
    const allowedOrigins = process.env.ALLOWED_ORIGINS || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins);
    // Health check endpoint
    if (pathname === '/health') {
        const whatsappProvider = process.env.WHATSAPP_PROVIDER || 'vonage';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'ragbox-voice',
            whatsapp: whatsappProvider,
            timestamp: new Date().toISOString(),
        }));
        return;
    }
    // CORS preflight for WebSocket
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
        });
        res.end();
        return;
    }
    // Info endpoint
    if (pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
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
        }));
        return;
    }
    // WhatsApp webhook endpoints
    if (pathname?.startsWith('/whatsapp/webhook')) {
        (0, webhook_1.handleWhatsAppWebhook)(req, res);
        return;
    }
    // 404 for everything else
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
});
exports.server = server;
// ============================================================================
// WEBSOCKET SERVER
// ============================================================================
const wss = (0, agent_ws_1.startAgentWSServer)(server);
exports.wss = wss;
// ============================================================================
// SERVER LIFECYCLE
// ============================================================================
server.listen(PORT, HOST, () => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  RAGbox Voice Server');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  HTTP:      http://${HOST}:${PORT}`);
    console.log(`  WebSocket: ws://${HOST}:${PORT}/agent/ws`);
    console.log(`  Health:    http://${HOST}:${PORT}/health`);
    console.log('═══════════════════════════════════════════════════════════════');
});
// Graceful shutdown
const shutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}, shutting down...`);
    // Close WebSocket server
    wss.close(() => {
        console.log('[Server] WebSocket server closed');
    });
    // Close HTTP server
    server.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
    });
    // Force exit after 10 seconds
    setTimeout(() => {
        console.error('[Server] Forced shutdown after timeout');
        process.exit(1);
    }, 10_000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('[Server] Uncaught exception:', error);
    shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled rejection at:', promise, 'reason:', reason);
});
