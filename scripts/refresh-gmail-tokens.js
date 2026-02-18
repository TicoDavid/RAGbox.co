/**
 * Weekly Gmail Token Refresh Script
 *
 * Keeps refresh tokens alive during the OAuth testing period
 * (before publishing approval — tokens expire every 7 days in testing mode).
 *
 * Run via Cloud Scheduler or manually:
 *   node scripts/refresh-gmail-tokens.js
 *
 * Requires env vars: DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 */

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  try {
    const credentials = await prisma.agentEmailCredential.findMany({
      where: { provider: 'google', isActive: true },
    });

    console.log('Found ' + credentials.length + ' active Gmail credentials');

    let refreshed = 0;
    let errors = 0;

    for (const cred of credentials) {
      try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: cred.refreshToken,
            grant_type: 'refresh_token',
          }),
        });

        if (response.ok) {
          await prisma.agentEmailCredential.update({
            where: { id: cred.id },
            data: { lastRefreshed: new Date(), errorCount: 0, lastError: null },
          });
          console.log('OK ' + cred.emailAddress + ' refreshed');
          refreshed++;
        } else {
          const err = await response.json();
          await prisma.agentEmailCredential.update({
            where: { id: cred.id },
            data: { errorCount: { increment: 1 }, lastError: JSON.stringify(err) },
          });
          console.log('FAIL ' + cred.emailAddress + ': ' + err.error);
          errors++;
        }
      } catch (e) {
        console.log('FAIL ' + cred.emailAddress + ': ' + e.message);
        errors++;
      }
    }

    console.log('\nSummary: ' + refreshed + ' refreshed, ' + errors + ' errors');
  } finally {
    await prisma.$disconnect();
  }
}

main();
