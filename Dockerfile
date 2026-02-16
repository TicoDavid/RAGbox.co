# RAGbox.co - Production Dockerfile
# Optimized multi-stage build for Cloud Run

# ==============================================
# Stage 1: Dependencies
# ==============================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files first (cache layer)
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (devDependencies needed for build stage)
RUN npm ci --ignore-scripts && npx prisma generate

# ==============================================
# Stage 2: Builder
# ==============================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy source code
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the Next.js application (standalone output)
RUN npm run build

# ==============================================
# Stage 3: Production Runner (minimal)
# ==============================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma query engine needs OpenSSL at runtime
RUN apk add --no-cache openssl

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone server + static assets (Next.js standalone output)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma runtime (engine + generated client only)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# Find and set Prisma query engine path explicitly
RUN ENGINE=$(find /app/node_modules/.prisma/client -name 'libquery_engine*' -type f 2>/dev/null | head -1) && \
    if [ -n "$ENGINE" ]; then echo "PRISMA_ENGINE=$ENGINE"; else echo "WARNING: No Prisma engine binary found"; fi

ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

# Cloud Run injects PORT env var (default 8080)
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

EXPOSE 8080

CMD ["node", "server.js"]
