# Mercury Voice Server — Inworld Runtime + RAGbox Bridge
FROM node:20

WORKDIR /app/server

# Copy package files for dependency caching
COPY server/package.json server/package-lock.json* ./

# Install ALL dependencies (devDeps needed for ts-node at runtime)
RUN npm install --include=dev

# Copy source (includes models/, components/, nodes/, etc.)
COPY server/ ./
# constants.ts lives one level up (imported as ../constants)
COPY constants.ts ../

# Cloud Run sets PORT env var (default 8080)
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["npx", "ts-node", "index.ts"]
