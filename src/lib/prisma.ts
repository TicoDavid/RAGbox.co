/**
 * Prisma Client Singleton - RAGbox.co
 *
 * Ensures a single Prisma client instance in development
 * to prevent exhausting database connections during hot reload.
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Append Prisma-specific pool params to DATABASE_URL at runtime
// (keeps the shared secret clean for Go backend compatibility)
function buildDatasourceUrl(): string {
  const base = process.env.DATABASE_URL || ''
  if (!base) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}connection_limit=5&pool_timeout=30&connect_timeout=30`
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: {
    db: { url: buildDatasourceUrl() },
  },
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
