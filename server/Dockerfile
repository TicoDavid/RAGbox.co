# RAGbox Voice Server - Production Dockerfile
# Separate Cloud Run service for WebSocket voice pipeline
# Service: mercury-voice | Port: 3003
# NOTE: Uses debian-slim (NOT alpine) because @inworld/runtime
#       ships glibc-linked native binaries (libinworld.so)

# ==============================================
# Stage 1: Dependencies
# ==============================================
FROM node:20-slim AS deps
WORKDIR /app

# Native module build deps (required by @inworld/runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy root package files (voice server shares the monorepo deps)
COPY package.json package-lock.json ./

# Copy Prisma schema (needed for prisma generate)
COPY prisma/ ./prisma/

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts

# Install Prisma CLI (devDep) just for generate, then remove it
RUN npm install --no-save prisma && npx prisma generate && npm rm prisma

# Rebuild native modules for linux
RUN npm rebuild

# ==============================================
# Stage 2: Builder (compile TypeScript)
# ==============================================
FROM node:20-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# Install TypeScript for compilation (not in prod deps)
RUN npm install --no-save typescript

# Copy voice server source (only files needed for compilation)
COPY server/index.ts server/agent-ws.ts server/inworld.ts \
     server/voice-pipeline.ts server/observability.ts server/rate-limit.ts \
     server/tsconfig.json ./server/
COPY server/tools/ ./server/tools/
COPY server/whatsapp/ ./server/whatsapp/

# Compile TypeScript to JavaScript
RUN npx tsc --project server/tsconfig.json

# ==============================================
# Stage 3: Production Runner
# ==============================================
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Security: non-root user
RUN groupadd --system --gid 1002 voicesvc && \
    useradd --system --uid 1002 --gid voicesvc mercury

# Copy compiled output + dependencies
COPY --from=builder /app/server/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./

# Set ownership
RUN chown -R mercury:voicesvc /app

USER mercury

# Cloud Run injects PORT; voice server reads VOICE_SERVER_PORT
ENV VOICE_SERVER_PORT=3003
ENV VOICE_SERVER_HOST=0.0.0.0

EXPOSE 3003

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:3003/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
