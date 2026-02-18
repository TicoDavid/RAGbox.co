# RAGböx Agent Email Identity System — ATOMIC CLI Build
## Phase E-EMAIL: Per-Agent Gmail Credentials + Inbound/Outbound Pipeline
### February 18, 2026 — Parallel Execution in 5 PowerShell Terminals

---

## EXECUTION MODEL

```
CLI A  ██████████░░░░░░░░░░░░░░░░░░░░  (20 min) DB + Token utility — RUNS FIRST, UNBLOCKS ALL
CLI B  ░░░░░░░░░░██████████████░░░░░░░  (25 min) OAuth connect flow — AFTER A
CLI C  ░░░░░░░░░░██████████████████░░░  (35 min) Inbound webhook — AFTER A
CLI D  ░░░░░░░░░░████████░░░░░░░░░░░░░  (15 min) Outbound refactor — AFTER A
CLI E  ██████████████░░░░░░░░░░░░░░░░░  (30 min) Privacy page + GCP publishing — ANYTIME
       ░░░░░░░░░░░░░░░░░░░░░░████████  DEPLOY + E2E TEST (after all pass)
```

---

## CODEBASE CONTEXT (Verified February 17, 2026)

| What | Value |
|------|-------|
| **Repo** | `C:\Users\d0527\RAGbox.co` |
| **GCP Project** | `ragbox-sovereign-prod` |
| **Region** | `us-east4` |
| **Frontend** | `https://ragbox-app-4rvm4ohelq-uk.a.run.app` |
| **Backend** | `https://ragbox-backend-100739220279.us-east4.run.app` |
| **Prisma** | `prisma/schema.prisma` (709 lines, 26 models) |
| **Migration** | `src/app/api/admin/migrate/route.ts` (ALTER TABLE IF NOT EXISTS pattern) |
| **Send-Email** | `src/app/api/mercury/actions/send-email/route.ts` |
| **Mercury Thread** | `src/app/api/mercury/thread/route.ts` + `messages/route.ts` |
| **MercuryAction model** | Exists — logs tool actions (email, SMS, WhatsApp) |
| **MercuryPersona model** | Exists — tenant-scoped persona config |
| **Existing OAuth** | Google OAuth via NextAuth for dashboard login (google-client-id / google-client-secret in Secret Manager) |
| **Existing Gmail** | Phase 12 — send-email uses session user's OAuth token, NOT a stored credential |
| **Existing Pub/Sub** | `roam-events` topic for ROAM webhooks |
| **Smoke test** | `scripts/smoke-test.sh` (18 endpoints) |
| **Auth pattern** | `getServerSession(authOptions)` for protected routes |
| **Internal auth** | `x-internal-auth` header checked against `ragbox-internal-auth-secret` |

### Current GCP Secrets (14)

```
ragbox-prod-database-url    ragbox-database-url       firebase-api-key
firebase-auth-domain        firebase-project-id       nextauth-secret
nextauth-url                google-client-id          google-client-secret
ragbox-backend-url          ragbox-internal-auth-secret
vonage-api-secret           roam-api-key              roam-webhook-secret
```

### What Email Looks Like TODAY (Phase 12)

The current `send-email` route grabs the **session user's Google OAuth access token** from NextAuth and calls Gmail API. This means:
- Only the logged-in user's Gmail can send
- No per-agent email identity
- No inbound email processing
- Single shared account (theconnexusai@gmail.com)
- OAuth is in Testing mode — refresh tokens expire every 7 days

---

## WHAT WE'RE BUILDING

Replace the single shared Gmail with a **per-agent credential architecture**:

1. Each Mercury persona/agent gets its own Gmail OAuth credential stored in DB
2. Outbound email sends FROM the agent's email (not the session user's)
3. Inbound email via Gmail Push Notifications → Pub/Sub → Mercury brain → auto-reply
4. Loop prevention (agent doesn't reply to itself)
5. Audit trail per agent per email
6. Foundation for Gmail OAuth publishing (removes 7-day token expiry)

### Data Flow — Inbound

```
Gmail Inbox (agent@domain.com)
  → Gmail Push Notification → Google Pub/Sub
    → POST /api/gmail/webhook
      → Find AgentEmailCredential by emailAddress
        → Gmail API: fetch full message (History API)
          → Parse: sender, subject, body, threadId
            → SKIP if From = agent's own email (loop prevention)
              → Create MercuryThreadMessage (channel: 'email', role: 'user')
                → Mercury brain processes → generates reply
                  → POST /api/mercury/actions/send-email (with agentId)
                    → Gmail API sends FROM agent's email
```

### Data Flow — Outbound

```
Mercury AI decides to send email (or user clicks "Evelyn, email Tara the SOC 2 update")
  → POST /api/mercury/actions/send-email { agentId, to, subject, body }
    → Lookup AgentEmailCredential by agentId
      → getValidAccessToken(agentId) — refresh if expired
        → Build RFC 2822 MIME message with From: agent email
          → Gmail API POST /messages/send
            → Log to MercuryAction { agentId, channel: 'email', status }
```

---

# ═══════════════════════════════════════════════════════
# CLI A — DATABASE + TOKEN UTILITY [RUN FIRST]
# Est: 20 min | Dependencies: NONE | Unblocks: B, C, D
# ═══════════════════════════════════════════════════════

Open PowerShell terminal 1:

```powershell
cd C:\Users\d0527\RAGbox.co
```

Paste the following into Claude Code:

```
claude "RAGböx Agent Email — CLI A: Database Schema + Token Utility

You are working on RAGbox.co — a Next.js 14 app with Prisma ORM. 
Repo: C:\Users\d0527\RAGbox.co
Prisma schema: prisma/schema.prisma (26 models, 709 lines)
Migration endpoint: src/app/api/admin/migrate/route.ts (uses ALTER TABLE ADD COLUMN IF NOT EXISTS pattern)
Auth: getServerSession(authOptions) for protected routes

Execute these steps IN ORDER. Do NOT skip any step. Verify compilation after each code change.

═══ STEP A-1: ADD PRISMA MODEL ═══

Open prisma/schema.prisma. Add this NEW model at the end (do NOT modify existing models yet):

model AgentEmailCredential {
  id            String    @id @default(cuid())
  agentId       String    @unique @map("agent_id")
  emailAddress  String    @map("email_address")
  provider      String    @default("google")
  refreshToken  String    @map("refresh_token")
  scopes        String    @default("https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.labels")
  isActive      Boolean   @default(true) @map("is_active")
  lastRefreshed DateTime? @map("last_refreshed")
  errorCount    Int       @default(0) @map("error_count")
  lastError     String?   @map("last_error")
  watchExpires  DateTime? @map("watch_expires")
  lastHistoryId String?   @map("last_history_id")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@index([emailAddress])
  @@map("agent_email_credentials")
}

THEN add these fields to the EXISTING MercuryPersona model (find it, add to the field list):
  emailEnabled  Boolean   @default(false) @map("email_enabled")
  emailAddress  String?   @map("email_address")

THEN add this field to the EXISTING MercuryAction model (find it, add to the field list):
  agentId       String?   @map("agent_id")

All new fields are optional or have defaults — this is non-breaking.

═══ STEP A-2: UPDATE MIGRATION ENDPOINT ═══

Open src/app/api/admin/migrate/route.ts. Add these migration SQL statements to the existing migration array, following the same pattern already in the file (ALTER TABLE ... ADD COLUMN IF NOT EXISTS wrapped in DO/EXCEPTION blocks):

-- New table
CREATE TABLE IF NOT EXISTS agent_email_credentials (
  id TEXT PRIMARY KEY,
  agent_id TEXT UNIQUE NOT NULL,
  email_address TEXT NOT NULL,
  provider TEXT DEFAULT 'google',
  refresh_token TEXT NOT NULL,
  scopes TEXT DEFAULT 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.labels',
  is_active BOOLEAN DEFAULT true,
  last_refreshed TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  watch_expires TIMESTAMPTZ,
  last_history_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_email_credentials_email ON agent_email_credentials(email_address);
CREATE INDEX IF NOT EXISTS idx_agent_email_credentials_agent ON agent_email_credentials(agent_id);

-- Add to mercury_personas
ALTER TABLE mercury_personas ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN DEFAULT false;
ALTER TABLE mercury_personas ADD COLUMN IF NOT EXISTS email_address TEXT;

-- Add to mercury_actions
ALTER TABLE mercury_actions ADD COLUMN IF NOT EXISTS agent_id TEXT;

═══ STEP A-3: GENERATE PRISMA CLIENT ═══

Run:
npx prisma generate
npx tsc --noEmit

Both must pass with zero errors. If prisma generate fails, fix the schema syntax. If tsc fails, fix type errors — likely the new fields need to be added to any TypeScript interfaces that map to these models.

═══ STEP A-4: CREATE DIRECTORY STRUCTURE ═══

mkdir -p src/app/api/agent/[agentId]/email/connect
mkdir -p src/app/api/agent/[agentId]/email/disconnect
mkdir -p src/app/api/agent/[agentId]/email/test
mkdir -p src/app/api/agent/email/oauth/callback
mkdir -p src/app/api/gmail/webhook
mkdir -p src/app/api/gmail/watch
mkdir -p src/app/api/cron/gmail-watch-renew
mkdir -p src/lib/gmail

═══ STEP A-5: CREATE TOKEN UTILITY ═══

Create src/lib/gmail/token.ts:

import { prisma } from '@/lib/prisma';

export class GmailAuthError extends Error {
  constructor(message: string, public agentId: string) {
    super(message);
    this.name = 'GmailAuthError';
  }
}

export async function getValidAccessToken(agentId: string): Promise<string> {
  const credential = await prisma.agentEmailCredential.findUnique({
    where: { agentId },
  });

  if (!credential) {
    throw new GmailAuthError('No email credential found for agent', agentId);
  }

  if (!credential.isActive) {
    throw new GmailAuthError('Email credential is disabled', agentId);
  }

  // Refresh the access token using the stored refresh token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: credential.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Increment error count
    await prisma.agentEmailCredential.update({
      where: { agentId },
      data: {
        errorCount: { increment: 1 },
        lastError: JSON.stringify(errorData),
        // Disable after 5 consecutive failures
        isActive: credential.errorCount >= 4 ? false : undefined,
      },
    });
    throw new GmailAuthError(
      `Token refresh failed: ${errorData.error || 'unknown'}`,
      agentId
    );
  }

  const tokenData = await response.json();

  // Reset error count on success, update lastRefreshed
  await prisma.agentEmailCredential.update({
    where: { agentId },
    data: {
      lastRefreshed: new Date(),
      errorCount: 0,
      lastError: null,
    },
  });

  return tokenData.access_token;
}

// Helper: get credential info (safe — never returns refreshToken)
export async function getCredentialStatus(agentId: string) {
  const cred = await prisma.agentEmailCredential.findUnique({
    where: { agentId },
    select: {
      id: true,
      agentId: true,
      emailAddress: true,
      provider: true,
      isActive: true,
      lastRefreshed: true,
      errorCount: true,
      lastError: true,
      watchExpires: true,
      createdAt: true,
    },
  });
  return cred;
}

IMPORTANT: Check that '@/lib/prisma' is the correct import path for the Prisma client in this codebase. Look at other files that import prisma (like src/app/api/mercury/thread/route.ts) and match their import path.

═══ STEP A-6: CREATE CREDENTIAL STATUS ROUTE ═══

Create src/app/api/agent/[agentId]/email/route.ts:

GET handler:
- Auth: getServerSession(authOptions) — return 401 if not authenticated
- Extract agentId from params
- Call getCredentialStatus(agentId)
- If no credential found: return { connected: false }
- If found: return { connected: true, emailAddress, provider, isActive, lastRefreshed, errorCount, lastError, watchExpires }
- NEVER return refreshToken in any response

═══ STEP A-7: CREATE DISCONNECT ROUTE ═══

Create src/app/api/agent/[agentId]/email/disconnect/route.ts:

DELETE handler:
- Auth: getServerSession(authOptions)
- Find credential by agentId
- If found: revoke the refresh token by calling POST https://oauth2.googleapis.com/revoke?token={refreshToken}
- Delete the credential from DB: prisma.agentEmailCredential.delete({ where: { agentId } })
- Also update MercuryPersona: set emailEnabled=false, emailAddress=null for matching persona
- Return { success: true }
- If not found: return 404

═══ STEP A-8: CREATE TEST EMAIL ROUTE ═══

Create src/app/api/agent/[agentId]/email/test/route.ts:

POST handler:
- Auth: getServerSession(authOptions)
- Call getValidAccessToken(agentId) 
- Get credential for the agent's emailAddress
- Build RFC 2822 email:
  From: credential.emailAddress
  To: credential.emailAddress (sends test to itself)
  Subject: 'RAGbox Email Test — [agentId]'
  Body: 'This is a test email from your RAGbox agent. If you received this, email sending is working correctly.'
- Base64url encode the message
- POST to https://gmail.googleapis.com/gmail/v1/users/me/messages/send
  Authorization: Bearer {accessToken}
  Body: { raw: base64urlMessage }
- Return { success: true, messageId } or error details

═══ STEP A-9: VERIFY ALL COMPILES ═══

Run these in order:
npx prisma generate
npx tsc --noEmit

Both MUST pass with zero errors before you stop. If there are TypeScript errors, fix them. Common issues:
- Import paths for prisma client
- Missing type definitions for agentId in params
- NextResponse import needed

Report: List every file you created/edited and confirm compilation status.
"
```

**WAIT** for CLI A to complete and report zero TypeScript errors before starting B, C, or D.

---

# ═══════════════════════════════════════════════════════
# CLI B — OAUTH CONNECT FLOW [AFTER CLI A]
# Est: 25 min | Dependencies: CLI A complete
# ═══════════════════════════════════════════════════════

Open PowerShell terminal 2:

```powershell
cd C:\Users\d0527\RAGbox.co
```

Paste into Claude Code:

```
claude "RAGböx Agent Email — CLI B: OAuth Connect Flow + Settings UI

You are working on RAGbox.co — a Next.js 14 app.
Repo: C:\Users\d0527\RAGbox.co
The AgentEmailCredential Prisma model already exists (CLI A created it).
The token utility exists at src/lib/gmail/token.ts.
Auth: getServerSession(authOptions) for protected routes.
Existing Google OAuth: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars are already set (used by NextAuth for login).

Execute these steps IN ORDER:

═══ STEP B-1: CREATE OAUTH CONNECT ROUTE ═══

Create src/app/api/agent/[agentId]/email/connect/route.ts:

GET handler:
- Auth: getServerSession(authOptions)
- Extract agentId from route params
- Build Google OAuth URL with these exact parameters:
  - client_id: process.env.GOOGLE_CLIENT_ID
  - redirect_uri: process.env.GMAIL_OAUTH_REDIRECT_BASE + '/api/agent/email/oauth/callback'
    (GMAIL_OAUTH_REDIRECT_BASE will be 'http://localhost:3000' locally, 'https://ragbox-app-4rvm4ohelq-uk.a.run.app' in production)
  - response_type: 'code'
  - scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.labels https://www.googleapis.com/auth/userinfo.email'
  - access_type: 'offline'
  - prompt: 'consent' (MUST be consent to get refresh_token)
  - state: agentId (pass agentId in state param — we verify it in callback)
- Return NextResponse.json({ url: oauthUrl })

CRITICAL: The redirect_uri MUST be a fixed path (/api/agent/email/oauth/callback) because GCP does not allow wildcard redirect URIs. The agentId travels in the state parameter.

═══ STEP B-2: CREATE OAUTH CALLBACK ROUTE ═══

Create src/app/api/agent/email/oauth/callback/route.ts:

This is a GET route that Google redirects to after the user authorizes Gmail access.

GET handler:
- Extract query params: code, state (= agentId), error
- If error: redirect to /dashboard?email_error={error}
- Validate state is a non-empty string (this is our agentId)
- Exchange code for tokens:
  POST https://oauth2.googleapis.com/token
  {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GMAIL_OAUTH_REDIRECT_BASE + '/api/agent/email/oauth/callback',
    grant_type: 'authorization_code'
  }
- Extract: access_token, refresh_token, scope from response
- CRITICAL: If no refresh_token in response, the user didn't get prompt=consent. Return error.
- Get user's email from Google:
  GET https://www.googleapis.com/oauth2/v3/userinfo
  Authorization: Bearer {access_token}
  Extract: email
- Upsert credential:
  prisma.agentEmailCredential.upsert({
    where: { agentId: state },
    create: {
      id: crypto.randomUUID().replace(/-/g, '').substring(0, 25),
      agentId: state,
      emailAddress: email,
      provider: 'google',
      refreshToken: refresh_token,
      scopes: scope,
      isActive: true,
      lastRefreshed: new Date(),
    },
    update: {
      emailAddress: email,
      refreshToken: refresh_token,
      scopes: scope,
      isActive: true,
      errorCount: 0,
      lastError: null,
      lastRefreshed: new Date(),
    },
  })
- Also update MercuryPersona for this agent:
  prisma.mercuryPersona.updateMany({
    where: { id: state },
    data: { emailEnabled: true, emailAddress: email }
  })
  (Use updateMany with where id=state as a safe approach — if persona doesn't exist, no error)
- Redirect to: /dashboard/settings/mercury?email=connected
  (Use NextResponse.redirect with the full URL)

═══ STEP B-3: CREATE EMAIL SETTINGS UI COMPONENT ═══

Find the Mercury settings page. Look for it at one of these paths:
- src/app/dashboard/settings/mercury/page.tsx
- src/app/(dashboard)/settings/mercury/page.tsx  
- src/components/dashboard/settings/MercurySettings.tsx

If there is an existing Mercury settings page, ADD an email section to it. If not, check which settings pages exist under src/app/dashboard/settings/ and add the email section to the most appropriate one.

The email settings section should:

1. On page load: fetch GET /api/agent/{agentId}/email
   (For agentId, use the current persona's ID — fetch it from GET /api/persona first)

2. IF connected (response.connected === true):
   - Show green 'Connected' badge
   - Show the email address (response.emailAddress)
   - Show last refreshed timestamp
   - Show 'Send Test Email' button → POST /api/agent/{agentId}/email/test
   - Show 'Disconnect Gmail' button (red, with confirmation) → DELETE /api/agent/{agentId}/email/disconnect
   - If response.errorCount > 0, show amber warning badge

3. IF not connected:
   - Show 'Connect Gmail' button (blue, prominent)
   - onClick: fetch GET /api/agent/{agentId}/email/connect → get { url } → window.location.href = url

4. Style to match the existing dark theme and design system. Use CSS variables: var(--bg-elevated), var(--text-primary), var(--border-default), etc.

5. After redirect back from OAuth (?email=connected in URL), show a success toast/notification.

═══ STEP B-4: VERIFY COMPILATION ═══

npx prisma generate
npx tsc --noEmit

Both must pass clean. Fix any errors.

═══ STEP B-5: ENV VAR NOTE ═══

The following env var needs to be set BEFORE testing:
- Local: Add to .env.local: GMAIL_OAUTH_REDIRECT_BASE=http://localhost:3000
- Production: Will be set during deploy step

Also, the OAuth callback URI must be registered in GCP Console:
- Go to: https://console.cloud.google.com/apis/credentials
- Edit the RAGbox OAuth 2.0 Client ID
- Add redirect URI: http://localhost:3000/api/agent/email/oauth/callback
- Add redirect URI: https://ragbox-app-4rvm4ohelq-uk.a.run.app/api/agent/email/oauth/callback

(David will do this manually in GCP Console)

Report: List all files created/edited and confirm zero TypeScript errors.
"
```

---

# ═══════════════════════════════════════════════════════
# CLI C — INBOUND GMAIL WEBHOOK [AFTER CLI A]
# Est: 35 min | Dependencies: CLI A complete
# ═══════════════════════════════════════════════════════

Open PowerShell terminal 3:

```powershell
cd C:\Users\d0527\RAGbox.co
```

Paste into Claude Code:

```
claude "RAGböx Agent Email — CLI C: Inbound Gmail Webhook + Push Notifications

You are working on RAGbox.co — a Next.js 14 app.
Repo: C:\Users\d0527\RAGbox.co
The AgentEmailCredential Prisma model and getValidAccessToken() already exist (CLI A created them).
Import getValidAccessToken from '@/lib/gmail/token' (or wherever the prisma import path is in this codebase).
The existing ROAM webhook at src/app/api/webhooks/roam/route.ts is a good reference for webhook patterns.

Execute these steps IN ORDER:

═══ STEP C-1: CREATE GMAIL WEBHOOK RECEIVER ═══

Create src/app/api/gmail/webhook/route.ts:

This receives Gmail push notifications via Google Pub/Sub. The payload is a Pub/Sub push message.

POST handler (NO auth session — this is called by Google Pub/Sub):

1. VERIFY the request is from Pub/Sub:
   - Check Authorization header: 'Bearer {token}' where token = process.env.GMAIL_PUBSUB_TOKEN
   - If token doesn't match: return 403
   - IMPORTANT: Always return 200 within 10 seconds even on processing errors (Pub/Sub retries on non-2xx)

2. Parse the Pub/Sub message:
   const body = await request.json();
   const data = JSON.parse(Buffer.from(body.message.data, 'base64').toString());
   // data = { emailAddress: string, historyId: string }

3. Find the agent credential:
   const credential = await prisma.agentEmailCredential.findFirst({
     where: { emailAddress: data.emailAddress, isActive: true }
   });
   If not found: return 200 (ack — don't retry for unknown emails)

4. Get valid access token:
   const accessToken = await getValidAccessToken(credential.agentId);

5. Fetch message history (only NEW messages since last check):
   GET https://gmail.googleapis.com/gmail/v1/users/me/history
   ?startHistoryId={credential.lastHistoryId}
   &historyTypes=messageAdded
   Authorization: Bearer {accessToken}

   If lastHistoryId is null (first time), use data.historyId from the notification.
   If history API returns 404 (historyId too old), do a full sync: GET /messages?maxResults=1&q=in:inbox

6. For each message in history.history[].messagesAdded[]:
   a. Fetch full message:
      GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{message.id}?format=full
      Authorization: Bearer {accessToken}
   
   b. Parse headers: From, Subject, Date, Message-ID, In-Reply-To
      Headers are in payload.headers array: { name, value }
   
   c. Parse body:
      - If payload.mimeType starts with 'text/plain': decode payload.body.data (base64url)
      - If multipart: find the text/plain part in payload.parts[]
      - Decode: Buffer.from(bodyData, 'base64url').toString('utf-8')
   
   d. LOOP PREVENTION — CRITICAL:
      Extract the From email address (parse 'Name <email@domain.com>' format)
      If fromEmail === credential.emailAddress: SKIP this message (agent sent it)
   
   e. Create inbound message in Mercury thread:
      await prisma.mercuryThreadMessage.create({
        data: {
          threadId: (find or create thread for this tenant),
          role: 'user',
          content: 'Email from ' + fromName + ' <' + fromEmail + '>:\nSubject: ' + subject + '\n\n' + bodyText,
          channel: 'email',
          metadata: JSON.stringify({
            gmailMessageId: message.id,
            gmailThreadId: message.threadId,
            from: fromEmail,
            subject: subject,
            inReplyTo: inReplyToHeader || null,
          }),
        },
      });
      
      NOTE: For threadId, look at how the existing ROAM webhook handler (src/app/api/roam/process-event/route.ts or src/app/api/webhooks/roam/route.ts) finds/creates the MercuryThread. Use the same pattern. The thread is per-tenant — find it by tenantId or create a new one.

7. Update the credential's lastHistoryId:
   await prisma.agentEmailCredential.update({
     where: { id: credential.id },
     data: { lastHistoryId: latestHistoryId.toString() },
   });

8. Return NextResponse.json({ processed: true }, { status: 200 });

WRAP the entire processing logic in try/catch. On ANY error, log it but still return 200 to prevent Pub/Sub infinite retries.

═══ STEP C-2: CREATE GMAIL WATCH SETUP ROUTE ═══

Create src/app/api/gmail/watch/route.ts:

POST handler:
- Auth: getServerSession(authOptions) — or accept x-internal-auth header (for cron)
- Body: { agentId: string }
- Get access token: getValidAccessToken(agentId)
- Call Gmail watch API:
  POST https://gmail.googleapis.com/gmail/v1/users/me/watch
  Authorization: Bearer {accessToken}
  Body: {
    topicName: 'projects/ragbox-sovereign-prod/topics/gmail-push-notifications',
    labelIds: ['INBOX']
  }
- Response: { historyId, expiration } (expiration is epoch ms, ~7 days from now)
- Update credential:
  prisma.agentEmailCredential.update({
    where: { agentId },
    data: {
      watchExpires: new Date(parseInt(response.expiration)),
      lastHistoryId: response.historyId.toString(),
    },
  });
- Return { success: true, watchExpires, historyId }

═══ STEP C-3: CREATE CRON WATCH RENEWAL ROUTE ═══

Create src/app/api/cron/gmail-watch-renew/route.ts:

GET handler:
- Auth: Check Authorization header = 'Bearer {CRON_SECRET}' env var
  OR check x-internal-auth header (for manual triggering)
- Find all credentials with expiring watches:
  prisma.agentEmailCredential.findMany({
    where: {
      isActive: true,
      watchExpires: { lt: new Date(Date.now() + 24 * 60 * 60 * 1000) } // expires within 24h
    }
  })
- For each credential:
  - Call getValidAccessToken(credential.agentId)
  - POST Gmail watch API (same as Step C-2)
  - Update watchExpires and lastHistoryId
  - Log success/failure
- Return { renewed: count, errors: errorList }

═══ STEP C-4: VERIFY COMPILATION ═══

npx prisma generate
npx tsc --noEmit

Fix any errors. Common issues:
- MercuryThreadMessage create needs correct field names (check Prisma model)
- Import paths for prisma, getValidAccessToken
- The 'channel' field on MercuryThreadMessage must accept 'email' — check the Prisma enum/type

═══ STEP C-5: GCP SETUP NOTE ═══

The following GCP resources need to be created BEFORE testing (David will do these manually):

1. Pub/Sub topic:
   gcloud pubsub topics create gmail-push-notifications --project=ragbox-sovereign-prod

2. Pub/Sub subscription (push to webhook):
   gcloud pubsub subscriptions create gmail-push-sub \
     --topic=gmail-push-notifications \
     --push-endpoint=https://ragbox-app-4rvm4ohelq-uk.a.run.app/api/gmail/webhook \
     --push-auth-token-audience=https://ragbox-app-4rvm4ohelq-uk.a.run.app \
     --project=ragbox-sovereign-prod

3. Grant Gmail publish permission:
   gcloud pubsub topics add-iam-policy-binding gmail-push-notifications \
     --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
     --role=roles/pubsub.publisher \
     --project=ragbox-sovereign-prod

4. Create GMAIL_PUBSUB_TOKEN secret:
   A random hex string that the Pub/Sub subscription sends as bearer token.
   David will create this and set it as env var.

5. Cloud Scheduler job (for watch renewal):
   gcloud scheduler jobs create http gmail-watch-renew \
     --schedule='0 6 * * *' \
     --uri=https://ragbox-app-4rvm4ohelq-uk.a.run.app/api/cron/gmail-watch-renew \
     --http-method=GET \
     --headers='Authorization=Bearer CRON_SECRET_VALUE' \
     --location=us-east4 \
     --project=ragbox-sovereign-prod

Report: List all files created/edited and confirm zero TypeScript errors.
"
```

---

# ═══════════════════════════════════════════════════════
# CLI D — OUTBOUND EMAIL REFACTOR [AFTER CLI A]
# Est: 15 min | Dependencies: CLI A complete
# ═══════════════════════════════════════════════════════

Open PowerShell terminal 4:

```powershell
cd C:\Users\d0527\RAGbox.co
```

Paste into Claude Code:

```
claude "RAGböx Agent Email — CLI D: Outbound Email Refactor

You are working on RAGbox.co — a Next.js 14 app.
Repo: C:\Users\d0527\RAGbox.co
The getValidAccessToken(agentId) function exists at src/lib/gmail/token.ts (CLI A created it).
The current send-email route is at src/app/api/mercury/actions/send-email/route.ts.
This route was built in Phase 12 and currently uses the SESSION USER's OAuth token to send email.

Execute these steps IN ORDER:

═══ STEP D-1: REFACTOR SEND-EMAIL ROUTE ═══

Open src/app/api/mercury/actions/send-email/route.ts. Read it completely first to understand the current logic.

The current flow is:
1. Auth: session user
2. Get access token from session user's OAuth
3. Build email
4. Send via Gmail API
5. Log to MercuryAction

MODIFY it to support TWO modes:

Mode 1 — Agent credential (NEW): If request body includes 'agentId':
- Import getValidAccessToken from '@/lib/gmail/token'
- Call getValidAccessToken(agentId) to get the agent's access token
- Lookup the agent's emailAddress from AgentEmailCredential
- Use AGENT's email as the From address
- Use AGENT's access token for Gmail API

Mode 2 — Session user (LEGACY, backward compatible): If NO agentId in request:
- Keep the existing logic EXACTLY as it is
- Use session user's OAuth token (the current behavior)

Here is the refactored logic flow:

const { to, subject, body: emailBody, agentId, replyToMessageId } = await request.json();

let accessToken: string;
let fromEmail: string;

if (agentId) {
  // === NEW: Agent credential mode ===
  accessToken = await getValidAccessToken(agentId);
  const cred = await prisma.agentEmailCredential.findUnique({
    where: { agentId },
  });
  if (!cred) {
    return NextResponse.json({ error: 'No email credential for agent' }, { status: 404 });
  }
  fromEmail = cred.emailAddress;
} else {
  // === LEGACY: Session user mode (existing code) ===
  // Keep whatever the current code does to get accessToken and fromEmail
  // Do NOT change the legacy path
}

THEN build the RFC 2822 message (keep existing email building logic, just use fromEmail as From):

const message = [
  'From: ' + fromEmail,
  'To: ' + to,
  'Subject: ' + subject,
  'Content-Type: text/html; charset=utf-8',
  '',
  emailBody,
].join('\r\n');

// If replyToMessageId is provided, add In-Reply-To and References headers
// This threads replies in Gmail

const raw = Buffer.from(message).toString('base64url');

// Send via Gmail API
const gmailResponse = await fetch(
  'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
  {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  }
);

THEN update the MercuryAction log to include agentId:

When creating the MercuryAction record, add agentId to the data:
  agentId: agentId || null

═══ STEP D-2: UPDATE TOOL EXECUTOR FOR AGENT CONTEXT ═══

Check src/lib/mercury/toolExecutor.ts — this is where Mercury's tool system calls send-email.

Find where it calls the send-email API endpoint. Add support for passing agentId through:
- If the Mercury session has an active persona with emailEnabled=true, include that persona's ID as agentId in the send-email request
- This way, when Evelyn decides to send an email via the tool system, it uses HER Gmail credential, not the session user's

Look at how the tool executor currently builds the fetch request to /api/mercury/actions/send-email and add the agentId field if a persona is active.

If the tool executor doesn't directly have access to the persona, check the mercuryStore (src/stores/mercuryStore.ts) or whatever state management passes context to tool execution.

═══ STEP D-3: VERIFY ═══

npx prisma generate
npx tsc --noEmit

Both must pass. Fix any errors.

Report: List all files edited, show the diff of what changed in send-email/route.ts, and confirm zero TypeScript errors.
"
```

---

# ═══════════════════════════════════════════════════════
# CLI E — GMAIL APP PUBLISHING [RUN ANYTIME]
# Est: 30 min active + 4-6 weeks Google review
# ═══════════════════════════════════════════════════════

Open PowerShell terminal 5:

```powershell
cd C:\Users\d0527\RAGbox.co
```

Paste into Claude Code:

```
claude "RAGböx Agent Email — CLI E: Privacy Page + Token Refresh Script

You are working on RAGbox.co — a Next.js 14 app with Tailwind CSS and dark theme.
Repo: C:\Users\d0527\RAGbox.co

═══ STEP E-1: CREATE PRIVACY POLICY PAGE ═══

Create src/app/privacy/page.tsx

This is a public page (no auth required) at https://ragbox.co/privacy.
It's required for Google OAuth app publishing.

Build a clean, professional privacy policy page that matches the RAGbox dark theme (var(--bg-primary), var(--text-primary), etc.). If those CSS vars aren't available on public pages, use a dark background (#0a0a0f or similar from the landing page) with white text.

Content MUST include:

1. RAGbox.co Privacy Policy (header)
2. Last Updated: February 2026

3. Section: What We Collect
   - Account information (name, email via Google OAuth)
   - Documents uploaded to your sovereign vault
   - Email metadata when Gmail integration is enabled (sender, subject, date — NOT email body stored permanently)
   - Conversation transcripts with AI assistants
   - Usage analytics and interaction patterns

4. Section: How We Use Gmail Access
   - Read emails: To enable AI agent email monitoring and response
   - Send emails: To send AI-generated replies on behalf of your configured agent
   - Manage labels: To organize processed vs. unprocessed emails
   - We NEVER share email content with third parties
   - We NEVER use email content for advertising
   - Gmail data is processed in real-time and not stored beyond conversation context

5. Section: Data Retention
   - Documents: Retained until you delete them
   - Conversation history: Retained for 90 days (configurable)
   - Audit logs: 7 years (SEC 17a-4 compliance)
   - Email credentials: Encrypted, deleted on disconnect

6. Section: Data Security
   - SOC 2 Type II + HIPAA compliant infrastructure
   - All data encrypted at rest (Google Cloud KMS) and in transit (TLS 1.3)
   - Document vault uses Customer-Managed Encryption Keys (CMEK)
   - Row-Level Security ensures tenant isolation

7. Section: Your Rights
   - Access, export, or delete your data at any time
   - Revoke Gmail access via Google Account settings or RAGbox dashboard
   - Request complete data deletion: theconnexusai@gmail.com

8. Section: Contact
   - ConnexUS AI Inc.
   - Email: theconnexusai@gmail.com

Add a 'Back to RAGbox' link at the top.

═══ STEP E-2: CREATE WEEKLY TOKEN REFRESH SCRIPT ═══

Create scripts/refresh-gmail-tokens.js

This is a standalone Node.js script run via Cloud Scheduler to keep refresh tokens alive during the OAuth testing period (before publishing approval).

const { PrismaClient } = require('@prisma/client');
// Note: This script runs standalone, not inside Next.js

async function main() {
  const prisma = new PrismaClient();
  
  const credentials = await prisma.agentEmailCredential.findMany({
    where: { provider: 'google', isActive: true },
  });
  
  console.log('Found ' + credentials.length + ' active Gmail credentials');
  
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
        console.log('✅ ' + cred.emailAddress + ' refreshed');
      } else {
        const err = await response.json();
        await prisma.agentEmailCredential.update({
          where: { id: cred.id },
          data: { errorCount: { increment: 1 }, lastError: JSON.stringify(err) },
        });
        console.log('❌ ' + cred.emailAddress + ': ' + err.error);
      }
    } catch (e) {
      console.log('❌ ' + cred.emailAddress + ': ' + e.message);
    }
  }
  
  await prisma.$disconnect();
}

main();

═══ STEP E-3: UPDATE SMOKE TEST ═══

Open scripts/smoke-test.sh and add these new endpoint checks:

# Agent Email
check 'Agent Email Status'    GET  '/api/agent/test-agent/email'  401
check 'Gmail Webhook'         POST '/api/gmail/webhook'  403  '{\"message\":{\"data\":\"\"}}'
check 'Gmail Watch'           POST '/api/gmail/watch'  401  '{\"agentId\":\"test\"}'
check 'Cron Watch Renew'      GET  '/api/cron/gmail-watch-renew'  401

(These should return 401/403 without auth — which proves the routes exist and auth is working)

═══ STEP E-4: VERIFY ═══

npx tsc --noEmit

Report all files created and confirm compilation.
"
```

---

# ═══════════════════════════════════════════════════════
# DEPLOY — AFTER ALL CLI TRACKS PASS COMPILATION
# ═══════════════════════════════════════════════════════

Once ALL five CLI tracks report zero TypeScript errors, run this in ONE terminal:

```powershell
cd C:\Users\d0527\RAGbox.co

# 1. Final compilation check
npx prisma generate
npx tsc --noEmit
npm run build

# ALL THREE must pass. If npm run build fails, fix errors.

# 2. Git commit
git add -A
git commit -m "feat: Agent Email Identity System — per-agent Gmail credentials

- AgentEmailCredential Prisma model + migration
- OAuth connect/disconnect/test routes per agent
- Gmail Push Notification webhook (inbound email → Mercury thread)
- Gmail watch setup + daily cron renewal
- send-email refactored: agent credential mode + legacy session mode
- Privacy policy page (Gmail publishing prerequisite)
- Weekly token refresh script (testing mode workaround)
- Loop prevention: agent skips emails from its own address
- MercuryAction audit includes agentId
- MercuryPersona emailEnabled + emailAddress fields"

git push origin main

# 3. Deploy frontend
gcloud builds submit --config=cloudbuild.yaml `
  --substitutions=SHORT_SHA="$(git rev-parse --short HEAD)" `
  --project=ragbox-sovereign-prod

# 4. Wait for build to complete
gcloud builds list --project=ragbox-sovereign-prod --limit=3

# 5. Run migration
$INTERNAL_SECRET = gcloud secrets versions access latest `
  --secret=ragbox-internal-auth-secret --project=ragbox-sovereign-prod
Invoke-RestMethod -Uri "https://ragbox-app-4rvm4ohelq-uk.a.run.app/api/admin/migrate" `
  -Method POST -Headers @{"x-internal-auth"=$INTERNAL_SECRET}
```

---

# ═══════════════════════════════════════════════════════
# GCP SETUP — MANUAL STEPS (David does these)
# ═══════════════════════════════════════════════════════

After deploy succeeds, run these GCP commands:

```powershell
# 1. Set new env var for OAuth redirect base
gcloud run services update ragbox-app --region=us-east4 `
  --project=ragbox-sovereign-prod `
  --update-env-vars=GMAIL_OAUTH_REDIRECT_BASE=https://ragbox-app-4rvm4ohelq-uk.a.run.app

# 2. Create Pub/Sub topic for Gmail push notifications
gcloud pubsub topics create gmail-push-notifications `
  --project=ragbox-sovereign-prod

# 3. Generate and store Pub/Sub verification token
$PUBSUB_TOKEN = -join ((48..57) + (97..102) | Get-Random -Count 32 | ForEach-Object {[char]$_})
echo $PUBSUB_TOKEN | gcloud secrets create gmail-pubsub-token `
  --data-file=- --project=ragbox-sovereign-prod

# 4. Set Pub/Sub token as env var
gcloud run services update ragbox-app --region=us-east4 `
  --project=ragbox-sovereign-prod `
  --update-secrets=GMAIL_PUBSUB_TOKEN=gmail-pubsub-token:latest

# 5. Create push subscription
gcloud pubsub subscriptions create gmail-push-sub `
  --topic=gmail-push-notifications `
  --push-endpoint=https://ragbox-app-4rvm4ohelq-uk.a.run.app/api/gmail/webhook `
  --project=ragbox-sovereign-prod

# 6. Grant Gmail permission to publish
gcloud pubsub topics add-iam-policy-binding gmail-push-notifications `
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com `
  --role=roles/pubsub.publisher `
  --project=ragbox-sovereign-prod

# 7. Generate and store cron secret
$CRON_SECRET = -join ((48..57) + (97..102) | Get-Random -Count 32 | ForEach-Object {[char]$_})
echo $CRON_SECRET | gcloud secrets create gmail-cron-secret `
  --data-file=- --project=ragbox-sovereign-prod

gcloud run services update ragbox-app --region=us-east4 `
  --project=ragbox-sovereign-prod `
  --update-secrets=CRON_SECRET=gmail-cron-secret:latest

# 8. Create Cloud Scheduler for daily watch renewal
gcloud scheduler jobs create http gmail-watch-renew `
  --schedule='0 6 * * *' `
  --uri=https://ragbox-app-4rvm4ohelq-uk.a.run.app/api/cron/gmail-watch-renew `
  --http-method=GET `
  --headers="Authorization=Bearer $CRON_SECRET" `
  --location=us-east4 `
  --project=ragbox-sovereign-prod

# 9. Register OAuth callback URI in GCP Console (MANUAL — browser)
# Go to: https://console.cloud.google.com/apis/credentials?project=ragbox-sovereign-prod
# Edit the RAGbox OAuth 2.0 Client ID
# Add redirect URI: https://ragbox-app-4rvm4ohelq-uk.a.run.app/api/agent/email/oauth/callback
```

---

# ═══════════════════════════════════════════════════════
# E2E VERIFICATION — AFTER DEPLOY + GCP SETUP
# ═══════════════════════════════════════════════════════

```powershell
# 1. Run extended smoke test
bash scripts/smoke-test.sh https://ragbox-app-4rvm4ohelq-uk.a.run.app

# 2. Check GCP errors
gcloud logging read 'severity=ERROR AND resource.type="cloud_run_revision" AND timestamp>="2026-02-18T00:00:00Z"' `
  --project=ragbox-sovereign-prod --limit=20
```

### Manual E2E Test Sequence

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open dashboard → Settings → Mercury → Email section | Shows "Connect Gmail" button |
| 2 | Click "Connect Gmail" | Redirects to Google OAuth consent screen |
| 3 | Authorize with theconnexusai@gmail.com | Redirects back to settings with ?email=connected |
| 4 | Check settings page | Shows green "Connected" badge + email address |
| 5 | Click "Send Test Email" | Test email arrives in theconnexusai@gmail.com inbox |
| 6 | Set up Gmail watch: POST /api/gmail/watch with agentId | Returns { success: true, watchExpires } |
| 7 | Send email TO theconnexusai@gmail.com from another account | Gmail webhook fires, Mercury thread gets inbound message |
| 8 | Check dashboard chat thread | Shows inbound email as user message with 'email' channel badge |
| 9 | Verify Mercury processes and sends reply | Reply appears in sender's inbox FROM theconnexusai@gmail.com |
| 10 | Check MercuryAction log | Shows both inbound + outbound with agentId |
| 11 | Verify NO email loop | Agent should NOT reply to its own emails |
| 12 | Click "Disconnect Gmail" | Credential deleted, settings shows "Connect Gmail" again |

---

# ═══════════════════════════════════════════════════════
# ENVIRONMENT VARIABLES — COMPLETE REFERENCE
# ═══════════════════════════════════════════════════════

| Variable | CLI Track | Where | Source/Value |
|----------|-----------|-------|-------------|
| GOOGLE_CLIENT_ID | A-D | Already set | Secret: google-client-id |
| GOOGLE_CLIENT_SECRET | A-D | Already set | Secret: google-client-secret |
| GMAIL_OAUTH_REDIRECT_BASE | B | Cloud Run + .env.local | `https://ragbox-app-4rvm4ohelq-uk.a.run.app` / `http://localhost:3000` |
| GMAIL_PUBSUB_TOKEN | C | Cloud Run | NEW secret: gmail-pubsub-token |
| CRON_SECRET | C | Cloud Run | NEW secret: gmail-cron-secret |
| GMAIL_REFRESH_TOKEN | Legacy | Cloud Run | Keep for fallback (existing) |

---

# ═══════════════════════════════════════════════════════
# FILE MAP — COMPLETE
# ═══════════════════════════════════════════════════════

| CLI | File | Action | Priority |
|-----|------|--------|----------|
| A | `prisma/schema.prisma` | EDIT | P0 |
| A | `src/app/api/admin/migrate/route.ts` | EDIT | P0 |
| A | `src/lib/gmail/token.ts` | CREATE | P0 |
| A | `src/app/api/agent/[agentId]/email/route.ts` | CREATE | P0 |
| A | `src/app/api/agent/[agentId]/email/disconnect/route.ts` | CREATE | P1 |
| A | `src/app/api/agent/[agentId]/email/test/route.ts` | CREATE | P1 |
| B | `src/app/api/agent/[agentId]/email/connect/route.ts` | CREATE | P0 |
| B | `src/app/api/agent/email/oauth/callback/route.ts` | CREATE | P0 |
| B | Mercury settings page (find existing) | EDIT | P0 |
| C | `src/app/api/gmail/webhook/route.ts` | CREATE | P0 |
| C | `src/app/api/gmail/watch/route.ts` | CREATE | P0 |
| C | `src/app/api/cron/gmail-watch-renew/route.ts` | CREATE | P1 |
| D | `src/app/api/mercury/actions/send-email/route.ts` | EDIT | P0 |
| D | `src/lib/mercury/toolExecutor.ts` | EDIT | P1 |
| E | `src/app/privacy/page.tsx` | CREATE | P0 |
| E | `scripts/refresh-gmail-tokens.js` | CREATE | P1 |
| E | `scripts/smoke-test.sh` | EDIT | P1 |

---

# ═══════════════════════════════════════════════════════
# RISKS + MITIGATIONS
# ═══════════════════════════════════════════════════════

| Risk | Severity | Mitigation |
|------|----------|------------|
| Gmail watch expires every 7 days | HIGH | Cloud Scheduler cron renews daily at 6 AM. Alert on failure. |
| Refresh token revoked by user in Google settings | HIGH | errorCount increments on each failure. After 5 failures, credential auto-disables. Admin notified. |
| OAuth app in testing mode — 7 day token expiry | MEDIUM | Weekly refresh script keeps tokens alive. Privacy page unblocks publishing submission. |
| Email loop (agent replies to itself) | HIGH | From header check in webhook — skip if From = credential.emailAddress. |
| Refresh token stored in plaintext in DB | HIGH | Phase 2: encrypt with GCP KMS before storing. For now, DB is encrypted at rest via Cloud SQL CMEK. |
| Pub/Sub delivery failure | MEDIUM | Always return 200 within 10s. Pub/Sub auto-retries with exponential backoff. |
| Multiple webhook deliveries for same email | MEDIUM | Use historyId tracking — only process messages since lastHistoryId. Deduplicate by gmailMessageId in metadata. |

---

# ═══════════════════════════════════════════════════════
# SUCCESS CRITERIA
# ═══════════════════════════════════════════════════════

Phase E-EMAIL is DONE when:

- [ ] AgentEmailCredential table exists in production database
- [ ] OAuth connect flow works end-to-end (button → Google → callback → credential stored)
- [ ] `GET /api/agent/{id}/email` returns credential status (never exposes refreshToken)
- [ ] `POST /api/agent/{id}/email/test` sends test email from agent's Gmail
- [ ] `DELETE /api/agent/{id}/email/disconnect` revokes token and deletes credential
- [ ] Outbound email with agentId sends FROM agent's email address
- [ ] Outbound email without agentId still works (legacy session mode — no regression)
- [ ] Gmail webhook receives push notifications and creates MercuryThreadMessage
- [ ] Loop prevention: agent's own emails are skipped in webhook
- [ ] Gmail watch setup returns expiration date
- [ ] Cron renewal route finds and renews expiring watches
- [ ] MercuryAction log includes agentId on all email actions
- [ ] Privacy page accessible at /privacy
- [ ] Settings UI shows connected/disconnected state with test/disconnect buttons
- [ ] Smoke test passes with new endpoints included
- [ ] Zero ERROR-severity GCP logs from deploy
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` clean
