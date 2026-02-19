# RAGbox Voice Server - Production Dockerfile
# Separate Cloud Run service for WebSocket voice pipeline
# Service: mercury-voice | Port: 3003

# ==============================================
# Stage 1: Dependencies
# ==============================================
FROM node:20-alpine AS deps
WORKDIR /app

# Native module build deps (required by @inworld/runtime)
RUN apk add --no-cache python3 make g++

# Copy root package files (voice server shares the monorepo deps)
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts

# Rebuild native modules for alpine
RUN npm rebuild

# ==============================================
# Stage 2: Builder (compile TypeScript)
# ==============================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

# Copy voice server source (only files needed for compilation)
COPY server/index.ts server/agent-ws.ts server/inworld.ts \
     server/observability.ts server/rate-limit.ts \
     server/tsconfig.json ./server/
COPY server/tools/ ./server/tools/
COPY server/whatsapp/ ./server/whatsapp/

# Compile TypeScript to JavaScript
RUN npx tsc --project server/tsconfig.json

# ==============================================
# Stage 3: Production Runner
# ==============================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Security: non-root user
RUN addgroup --system --gid 1001 voice && \
    adduser --system --uid 1001 mercury

# Copy compiled output + dependencies
COPY --from=builder /app/server/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./

# Set ownership
RUN chown -R mercury:voice /app

USER mercury

# Cloud Run injects PORT; voice server reads VOICE_SERVER_PORT
ENV VOICE_SERVER_PORT=3003
ENV VOICE_SERVER_HOST=0.0.0.0

EXPOSE 3003

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -q --spider http://localhost:3003/health || exit 1

CMD ["node", "dist/index.js"]
