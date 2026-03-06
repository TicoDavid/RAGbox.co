# Mercury Voice — Inworld Runtime v0.8 Voice Pipeline
# Standalone service: Cloud Run | Port: 3003
# NOTE: Uses debian-slim (NOT alpine) — @inworld/runtime ships glibc-linked native binaries

# ==============================================
# Stage 1: Dependencies
# ==============================================
FROM node:20-slim AS deps
WORKDIR /app

# Native module build deps (required by @inworld/runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

RUN npm install --omit=dev
RUN npm rebuild

# ==============================================
# Stage 2: Builder (compile TypeScript)
# ==============================================
FROM node:20-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src/ ./src/

# Install TypeScript for compilation
RUN npm install --no-save typescript
RUN npx tsc

# ==============================================
# Stage 3: Production Runner
# ==============================================
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Security: non-root user
RUN groupadd --system --gid 1002 voicesvc && \
    useradd --system --uid 1002 --gid voicesvc mercury

COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./

# Copy VAD model
COPY assets/ ./dist/assets/

RUN chown -R mercury:voicesvc /app
USER mercury

ENV VOICE_SERVER_PORT=3003
EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://localhost:3003/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
