/**
 * Demo Data Seed Script - RAGbox.co
 *
 * Seeds the database with 10 realistic documents and 4 content gaps.
 *
 * Usage: npx tsx scripts/seed-demo.ts
 *
 * Requires:
 * - DATABASE_URL env var for Prisma
 * - GO_BACKEND_URL env var for document upload API (optional)
 */

import { PrismaClient } from '@prisma/client'
import { DEMO_DOCUMENTS, DEMO_CONTENT_GAPS } from './demo-data/documents'

const prisma = new PrismaClient()

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL || 'demo@ragbox.co'

async function main() {
  console.log('=== RAGbox Demo Data Seed ===\n')

  // Find or create demo user
  let user = await prisma.user.findUnique({ where: { email: SEED_USER_EMAIL } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: SEED_USER_EMAIL,
        name: 'Demo User',
        role: 'Partner',
      },
    })
    console.log(`Created demo user: ${user.email} (${user.id})`)
  } else {
    console.log(`Using existing user: ${user.email} (${user.id})`)
  }

  // Create default vault
  let vault = await prisma.vault.findFirst({ where: { userId: user.id } })
  if (!vault) {
    vault = await prisma.vault.create({
      data: {
        name: 'Demo Vault',
        userId: user.id,
        status: 'open',
      },
    })
    console.log(`Created vault: ${vault.name} (${vault.id})`)
  } else {
    console.log(`Using existing vault: ${vault.name} (${vault.id})`)
  }

  // Seed documents
  console.log('\n--- Seeding Documents ---')
  let successCount = 0
  let skipCount = 0

  for (const doc of DEMO_DOCUMENTS) {
    // Check if already exists
    const existing = await prisma.document.findFirst({
      where: { userId: user.id, filename: doc.filename },
    })

    if (existing) {
      console.log(`  SKIP: ${doc.filename} (already exists)`)
      skipCount++
      continue
    }

    try {
      // Try uploading via Go backend first
      const uploaded = await uploadViaBackend(user.id, vault.id, doc)

      if (!uploaded) {
        // Fallback: create document record directly in Prisma
        await prisma.document.create({
          data: {
            userId: user.id,
            vaultId: vault.id,
            filename: doc.filename,
            originalName: doc.filename,
            mimeType: doc.mimeType,
            fileType: doc.filename.split('.').pop() || 'pdf',
            sizeBytes: Buffer.byteLength(doc.content, 'utf-8'),
            extractedText: doc.content,
            indexStatus: 'Indexed',
            isPrivileged: doc.isPrivileged || false,
          },
        })
      }

      console.log(`  OK: ${doc.filename}`)
      successCount++
    } catch (error) {
      console.error(`  FAIL: ${doc.filename} — ${error instanceof Error ? error.message : error}`)
    }
  }

  // Update vault document count
  await prisma.vault.update({
    where: { id: vault.id },
    data: { documentCount: await prisma.document.count({ where: { vaultId: vault.id } }) },
  })

  console.log(`\nDocuments: ${successCount} created, ${skipCount} skipped`)

  // Seed content gaps
  console.log('\n--- Seeding Content Gaps ---')
  let gapCount = 0

  for (const gap of DEMO_CONTENT_GAPS) {
    // Create multiple occurrences
    for (let i = 0; i < gap.occurrences; i++) {
      const existing = await prisma.contentGap.findFirst({
        where: { userId: user.id, queryText: gap.queryText },
      })

      if (existing && i === 0) {
        console.log(`  SKIP: "${gap.queryText}" (already exists)`)
        break
      }

      if (i === 0) {
        await prisma.contentGap.create({
          data: {
            userId: user.id,
            queryText: gap.queryText,
            confidenceScore: gap.confidenceScore,
            suggestedTopics: gap.suggestedTopics,
            status: 'open',
          },
        })
        gapCount++
        console.log(`  OK: "${gap.queryText}" (${gap.occurrences}x, ${(gap.confidenceScore * 100).toFixed(0)}% confidence)`)
      }
    }
  }

  console.log(`\nContent Gaps: ${gapCount} created`)

  // Summary
  const totalDocs = await prisma.document.count({ where: { userId: user.id } })
  const totalGaps = await prisma.contentGap.count({ where: { userId: user.id } })
  console.log('\n=== Seed Complete ===')
  console.log(`User: ${user.email}`)
  console.log(`Documents: ${totalDocs}`)
  console.log(`Content Gaps: ${totalGaps}`)
  console.log(`Vault: ${vault.name}`)
}

async function uploadViaBackend(
  userId: string,
  vaultId: string,
  doc: typeof DEMO_DOCUMENTS[number],
): Promise<boolean> {
  try {
    const response = await fetch(`${GO_BACKEND_URL}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
        'X-User-ID': userId,
      },
      body: JSON.stringify({
        filename: doc.filename,
        vaultId,
        content: doc.content,
        mimeType: doc.mimeType,
        isPrivileged: doc.isPrivileged || false,
      }),
    })

    return response.ok
  } catch {
    // Backend not available — fall back to direct Prisma insert
    return false
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
