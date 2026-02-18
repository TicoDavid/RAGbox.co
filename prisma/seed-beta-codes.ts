/**
 * Seed 50 beta invite codes into the database.
 *
 * Batch 1 (1-20):  David's direct network (legal vertical)
 * Batch 2 (21-40): Inbound from landing page CTA
 * Batch 3 (41-50): Reserved for investor demos
 *
 * Run: npx ts-node prisma/seed-beta-codes.ts
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No I/O/0/1 to avoid confusion
  let random = ''
  for (let i = 0; i < 6; i++) {
    random += chars[crypto.randomInt(chars.length)]
  }
  return `RBX-LEGAL-${random}`
}

async function main() {
  const codes: { code: string; batch: number }[] = []
  const usedCodes = new Set<string>()

  for (let i = 1; i <= 50; i++) {
    let code: string
    do {
      code = generateCode()
    } while (usedCodes.has(code))
    usedCodes.add(code)

    const batch = i <= 20 ? 1 : i <= 40 ? 2 : 3
    codes.push({ code, batch })
  }

  const result = await prisma.betaCode.createMany({
    data: codes,
    skipDuplicates: true,
  })

  console.log(`Seeded ${result.count} beta codes`)
  console.log('')
  console.log('=== Batch 1: David Network (20 codes) ===')
  codes.filter(c => c.batch === 1).forEach(c => console.log(`  ${c.code}`))
  console.log('')
  console.log('=== Batch 2: Inbound CTA (20 codes) ===')
  codes.filter(c => c.batch === 2).forEach(c => console.log(`  ${c.code}`))
  console.log('')
  console.log('=== Batch 3: Investor Demos (10 codes) ===')
  codes.filter(c => c.batch === 3).forEach(c => console.log(`  ${c.code}`))
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
