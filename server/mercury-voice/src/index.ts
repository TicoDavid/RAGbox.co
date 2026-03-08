import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { stopInworldRuntime } from '@inworld/runtime';
import { VADFactory } from '@inworld/runtime/primitives/vad';
import { createServer } from 'http';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { MessageHandler } from './message_handler';
import { STTGraph } from './stt_graph';
import { buildChatGraph } from './chat_graph';
import { DEFAULT_VAD_MODEL_PATH } from './constants';
import { MercurySession } from './types';
dotenv.config();

const app = express();
const server = createServer(app);
const webSocket = new WebSocketServer({ noServer: true });
const PORT = process.env.PORT || process.env.VOICE_SERVER_PORT || 3003;
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || '';
const VOICE_JWT_SECRET = process.env.VOICE_JWT_SECRET || '';

app.use(express.json());

// CORS
app.use((_req, res, next) => {
  const allowed = process.env.ALLOWED_ORIGINS || '*';
  res.header('Access-Control-Allow-Origin', allowed);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, Content-Type, Accept, Authorization, X-Internal-Auth, X-User-ID'
  );
  if (_req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

let vadClient: Awaited<ReturnType<typeof VADFactory.createLocal>>;
let sttGraph: STTGraph;

// Session management
const sessions: Record<string, { ws?: WebSocket; session: MercurySession; handler?: MessageHandler }> = {};
const wsTokens: Record<string, { token: string; expiresAt: number }> = {};
const WS_TOKEN_TTL_MS = 5 * 60 * 1000;

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'mercury-voice',
    stt: sttGraph ? 'ready' : 'initializing',
    vad: vadClient ? 'ready' : 'initializing',
    timestamp: new Date().toISOString(),
  });
});

// Create session — requires internal auth
app.post('/create-session', (req, res) => {
  const authHeader = req.headers['x-internal-auth'] as string;
  if (!INTERNAL_AUTH_SECRET || authHeader !== INTERNAL_AUTH_SECRET) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const userId = (req.headers['x-user-id'] as string) || req.body.userId;
  if (!userId) {
    res.status(400).json({ error: 'userId required' });
    return;
  }

  const sessionKey = uuidv4();
  const wsToken = uuidv4();

  const mercurySession: MercurySession = {
    userId,
    personaId: req.body.personaId,
    voiceId: req.body.voiceId,
    threadId: req.body.threadId,
    userName: req.body.userName,
  };

  sessions[sessionKey] = { session: mercurySession };
  wsTokens[sessionKey] = {
    token: wsToken,
    expiresAt: Date.now() + WS_TOKEN_TTL_MS,
  };

  console.log(`[Session] Created ${sessionKey} for user ${userId}`);
  res.json({ sessionKey, wsToken });
});

// WebSocket connection handler
webSocket.on('connection', (ws, request) => {
  const url = new URL(request.url!, `http://${request.headers.host || 'localhost'}`);
  const key = url.searchParams.get('key');

  if (!key || !sessions[key]) {
    ws.close(4000, 'Invalid session key');
    return;
  }

  sessions[key].ws = ws;
  console.log(`[WS] Connected for session: ${key}`);

  const handler = new MessageHandler(
    sttGraph,
    vadClient,
    (data: Record<string, unknown>) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    },
    (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    },
    buildChatGraph,
    sessions[key].session
  );
  sessions[key].handler = handler;

  // Send time-aware greeting on session start (non-blocking)
  handler.sendGreeting().catch((err) => {
    console.error(`[WS] Greeting error for ${key} (non-fatal):`, err);
  });

  ws.on('error', (err) => console.error(`[WS] Error for ${key}:`, err));

  ws.on('message', (data: RawData, isBinary: boolean) => {
    handler.handleMessage(data, isBinary, key).catch((err) => {
      console.error(`[WS] Unhandled error in message handler for ${key}:`, err);
    });
  });

  ws.on('close', async () => {
    console.log(`[WS] Disconnected for session: ${key}`);
    if (sessions[key]?.handler) {
      await sessions[key].handler!.destroy();
    }
    delete sessions[key];
  });
});

// WebSocket upgrade handler
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url!, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/ws') {
    // Internal token auth: /ws?key=<sessionKey>&wsToken=<wsToken>
    const key = url.searchParams.get('key') || undefined;
    const token = url.searchParams.get('wsToken') || undefined;

    let allowed = false;

    if (key && token) {
      const record = wsTokens[key];
      if (record && record.token === token && record.expiresAt >= Date.now()) {
        allowed = true;
        delete wsTokens[key]; // one-time use
        console.log(`[WS] Token auth success for session: ${key}`);
      }
    }

    if (!allowed) {
      console.warn('[WS] Auth failed for:', request.url);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    webSocket.handleUpgrade(request, socket, head, (ws) => {
      webSocket.emit('connection', ws, request);
    });
  } else if (url.pathname === '/agent/ws') {
    // Frontend JWT auth: /agent/ws?token=<JWT>
    const jwtToken = url.searchParams.get('token');

    if (!jwtToken || !VOICE_JWT_SECRET) {
      console.warn('[WS] JWT auth failed — missing token or VOICE_JWT_SECRET');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    let payload: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(jwtToken, VOICE_JWT_SECRET);
      if (typeof decoded === 'string') throw new Error('unexpected string JWT');
      payload = decoded;
    } catch (err) {
      console.warn('[WS] JWT verification failed:', err instanceof Error ? err.message : err);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const userId = (payload.userId as string) || '';
    if (!userId) {
      console.warn('[WS] JWT missing userId claim');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Auto-create session from JWT claims (includes per-user voice settings)
    const sessionKey = uuidv4();
    const mercurySession: MercurySession = {
      userId,
      voiceId: (payload.voiceId as string) || undefined,
      temperature: typeof payload.temperature === 'number' ? payload.temperature : undefined,
      speakingRate: typeof payload.speakingRate === 'number' ? payload.speakingRate : undefined,
      userName: (payload.userName as string) || (payload.name as string) || undefined,
    };
    sessions[sessionKey] = { session: mercurySession };

    // Rewrite URL so the connection handler can find the session by key
    const upgraded = new URL(request.url!, `http://${request.headers.host || 'localhost'}`);
    upgraded.searchParams.set('key', sessionKey);
    request.url = `${upgraded.pathname}?${upgraded.searchParams.toString()}`;

    console.log(`[WS] JWT auth success for user ${userId}, session: ${sessionKey}`);

    webSocket.handleUpgrade(request, socket, head, (ws) => {
      webSocket.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, async () => {
  try {
    if (!process.env.INWORLD_API_KEY) {
      throw new Error('INWORLD_API_KEY env variable is required');
    }

    // Initialize VAD client
    const vadModelPath =
      process.env.VAD_MODEL_PATH ||
      path.join(__dirname, DEFAULT_VAD_MODEL_PATH);
    vadClient = await VADFactory.createLocal({ modelPath: vadModelPath });
    console.log('[Init] VAD client initialized');

    // Initialize STT Graph
    sttGraph = await STTGraph.create({
      apiKey: process.env.INWORLD_API_KEY!,
    });
    console.log('[Init] STT Graph initialized');

    console.log(`[Init] Mercury Voice running on port ${PORT}`);
    console.log(`[Init] WebSocket: ws://localhost:${PORT}/ws?key=<session_key>`);
    console.log(`[Init] Backend: ${process.env.GO_BACKEND_URL || 'http://localhost:8080'}`);
  } catch (error) {
    console.error('[Init] Failed to start:', error);
    process.exit(1);
  }
});

// Graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('[Shutdown] Graceful shutdown...');

  try {
    // Close all WebSocket connections
    webSocket.clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
        ws.close();
      }
    });
    webSocket.close();

    // Destroy all message handlers
    for (const key of Object.keys(sessions)) {
      if (sessions[key]?.handler) {
        await sessions[key].handler!.destroy();
      }
    }

    // Stop STT graph
    if (sttGraph) {
      await sttGraph.destroy();
    }

    server.close(() => console.log('[Shutdown] HTTP server closed'));

    stopInworldRuntime()
      .then(() => console.log('[Shutdown] Inworld Runtime stopped'))
      .catch(() => {});

    console.log('[Shutdown] Complete');
  } catch {
    // Ignore shutdown errors
  }

  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', err);
});
