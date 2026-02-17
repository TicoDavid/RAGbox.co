# Mercury Voice Server — Inworld Runtime + RAGbox Bridge
FROM node:20-slim

WORKDIR /app/server

# Copy package files for dependency caching
COPY server/package.json server/package-lock.json* ./

# Install all dependencies (ts-node needed at runtime for TypeScript execution)
RUN npm install --include=dev

# Copy source (includes models/, components/, nodes/, etc.)
COPY server/ ./
# constants.ts lives one level up (imported as ../constants)
COPY constants.ts ../

# Cloud Run sets PORT env var (default 8080)
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# --transpile-only skips type checking for faster startup
CMD ["npx", "ts-node", "--transpile-only", "index.ts"]
