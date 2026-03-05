# Mercury Quick Start Guide

> Mercury is your AI assistant inside RAGbox — available via text chat, voice, WhatsApp, email, and SMS.

---

## What is Mercury?

Mercury is the conversational interface for your RAGbox knowledge base. Upload documents to the Vault, then ask Mercury questions — she retrieves relevant passages, generates answers with citations, and keeps a unified conversation thread across all channels.

---

## Text Chat

### Getting Started

1. Open the **RAGbox dashboard**
2. The Mercury panel is on the **right side** of the screen
3. Type your question in the input bar at the bottom
4. Press **Enter** or click the send button

### Reading Responses

Mercury's responses include:

- **Answer** — The main response text, grounded in your documents
- **Citations** — Numbered references `[1]`, `[2]` linking to source passages
- **Sources tab** — Document names, chunk indices, and relevance scores
- **Evidence tab** — Documents searched, chunks evaluated, and model used

### Response Layouts

Mercury supports three response display modes, selectable via the layout toggle in the top-right corner:

| Layout | Style | Best For |
|--------|-------|----------|
| **Dossier** | Dark card with gold border, confidence badge, collapsible evidence drawer | Executive briefings, audit review |
| **Conversation** | No cards or borders, inline citation chips with blue glow | Natural dialogue, quick Q&A |
| **Analyst** | 60/40 split view — answer left, evidence right, simultaneous visibility | Deep research, evidence comparison |

Your layout choice persists across sessions (stored in `ragbox-chat-storage`). In incognito mode, layout is not persisted.

### Tips

- Be specific: "What are the payment terms in the Acme contract?" works better than "Tell me about Acme"
- Ask follow-up questions — Mercury maintains conversation context
- Use the **persona selector** to change Mercury's response style (CEO, Legal, Technical, etc.)

---

## Voice Mode

### Activating Voice

1. Click the **power button** in the Mercury voice panel
2. Wait for the status indicator to show **Online** (green dot)
3. Mercury will speak a greeting automatically

### Speaking to Mercury

1. Status shows **Listening** (green, pulsing) — Mercury is ready for your voice
2. Speak your question naturally
3. Status changes to **Processing** (amber) while Mercury thinks
4. Mercury responds with both **text** and **speech**
5. After speaking, Mercury returns to **Listening** automatically

### Voice Controls

| Control | Action |
|---------|--------|
| **Power button** | Connect/disconnect voice session |
| **VAD toggle** | Enable/disable Voice Activity Detection |
| **Audio level bar** | Shows your microphone input level |

### Voice Settings (V2)

Configure voice parameters in **Settings → Voice**:

| Setting | Range | Description |
|---------|-------|-------------|
| **Voice** | Dynamic list | Select from 25+ available voices (fetched from Inworld API) |
| **Expressiveness** | 0–100% | Controls vocal emotion/variation (maps to TTS temperature) |
| **Speaking Rate** | 0.5×–2.0× | Speed of speech playback |
| **Preview** | Button | Audition the selected voice with current settings |

Changes take effect on the next voice session connection.

### Voice Status Indicators

| Indicator | Meaning |
|-----------|---------|
| Green pulsing | Listening — speak now |
| Amber pulsing | Processing your question |
| Blue pulsing | Mercury is speaking |
| Red | Error — try reconnecting |
| Grey | Offline — press power to connect |

---

## Channels

Mercury conversations are unified into a single thread, regardless of which channel you use. Each message is tagged with a channel badge:

| Badge | Channel | Color | How to Use |
|-------|---------|-------|------------|
| Chat | Dashboard text | Blue | Type in Mercury panel |
| Voice | Dashboard voice | Purple | Use voice panel power button |
| WhatsApp | WhatsApp messaging | Green | Send a message to Mercury's WhatsApp number |
| Email | Email | Amber | Send an email to Mercury's configured address |
| SMS | Text message | Cyan | Send an SMS to Mercury's number |
| ROAM | External integrations | Orange | Via API integrations |

All messages from all channels appear in the same conversation thread with their channel badge.

---

## Persona Configuration

Mercury can adopt different response styles depending on your role. Access personas via the persona selector dropdown in the chat input area.

### Available Personas

| Persona | Focus |
|---------|-------|
| **Professional** (default) | Precise, citation-focused, formal |
| **Friendly** | Warm, conversational, accessible |
| **Technical** | Detailed analysis with cross-references |
| **CEO** | Board-level impact, strategy, risk |
| **CFO** | Financial metrics, obligations, numbers |
| **CMO** | Brand, market intelligence, growth |
| **COO** | Operations, compliance, SLAs |
| **CPO** | Product strategy, features, technical debt |
| **CTO** | Architecture, security, scalability |
| **Legal** | Precise language, contractual terms, regulations |
| **Compliance** | Policy violations, control gaps, remediation |
| **Auditor** | Control effectiveness, material weaknesses |
| **Whistleblower** | Anomalies, irregularities, forensic analysis |

### Changing Persona

1. Open the Mercury config (gear icon in Mercury panel header)
2. Select a personality preset or write a custom prompt
3. Save — Mercury's responses will reflect the new persona immediately

---

## Silence Protocol

When Mercury's confidence in an answer drops below the configured threshold (default: 60%), the **Silence Protocol** activates:

- Mercury will explicitly state that she cannot confidently answer the question
- The response will indicate which documents were searched
- No speculative or hallucinated content is generated

This ensures that RAGbox never fabricates answers. If Mercury doesn't know, she says so.

### Adjusting the Threshold

The silence threshold is configurable in Mercury settings:

- **Lower threshold (e.g., 0.40):** Mercury answers more aggressively, may include lower-confidence responses
- **Higher threshold (e.g., 0.80):** Mercury stays silent more often, only answers when highly confident
- **Default: 0.60** — Balanced between coverage and accuracy

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Voice not connecting | Check browser microphone permissions. Ensure you're on HTTPS. |
| No response after speaking | Verify the green "Listening" indicator is active. Try toggling VAD. |
| Citations missing | The query may not have matched any vault documents. Upload relevant files. |
| "Voice is temporarily unavailable" | The voice service may be restarting. Text chat remains available. |

---

## Voice Session History

Mercury now maintains conversation context across voice sessions. When you start a voice session, Mercury loads recent messages from your current thread — she remembers what was discussed in previous text and voice interactions within the same thread.

---

## Email & SMS Actions

Mercury can send emails and text messages on your behalf. These are tool actions detected from natural language:

### Sending Email

```
"Email the contract summary to jane@acme.com"
"Send an email about the Q3 report to cfo@company.com"
"Mail the risk analysis to legal@firm.com"
```

Mercury will:
1. Detect the email intent and recipient
2. If the content references documents (e.g., "summary of"), Mercury queries the vault and generates the email body
3. Show a confirmation preview with To, Subject, and Body
4. Send only after you confirm

### Sending SMS

```
"Text the key dates to +1-555-123-4567"
"Send a text about the deadline to +12025551234"
"SMS the update to +1 800 555 0100"
```

Mercury strips formatting from phone numbers and shows a confirmation before sending.

### Confirmation Flow

All outbound communications require explicit confirmation. Mercury never sends an email or SMS without showing you the full message first and waiting for approval.

---

## User Profile

Your profile is accessible at **Settings → Profile**:

| Field | Description |
|-------|-------------|
| **Display Name** | Shown in Mercury responses and audit logs (max 100 chars) |
| **Email** | Auto-populated from OAuth, read-only |
| **Avatar** | Profile picture from OAuth provider |
| **Role** | Determines feature access (Partner, Admin, Associate) |

Only users with **Partner** or **Admin** role can access privileged mode.

---

## Cross-Session Memory

Mercury remembers context across sessions. When you close a session, Mercury automatically saves a summary of:

- Topics discussed
- Decisions made
- Action items identified
- Message count

On your next visit, Mercury loads the last 3 session summaries to maintain continuity. This means Mercury can reference previous conversations naturally.

---

## Document Scope

Focus Mercury on a single document by selecting it in the vault before asking questions. When document scope is active:

- Queries only search within the selected document
- Citations reference only that document
- Useful for deep analysis of a single contract or report

Clear the scope to return to searching all documents.

---

## Incognito Mode

Toggle incognito mode to prevent message persistence. In incognito:

- Messages are not saved to the thread
- Messages are excluded from session summaries
- RAG retrieval still works normally
- Useful for sensitive queries you don't want logged

---

## Mercury Settings

Configure Mercury via **Settings** (gear icon). The modal has 4 tabs:

### Identity

| Field | Description |
|-------|-------------|
| **Agent Name** | Mercury's display name (splits into first/last for DB) |
| **Title** | Shown under name (default: "AI Assistant") |
| **Greeting** | Welcome message on new sessions |

### Voice

| Setting | Range | Description |
|---------|-------|-------------|
| **Voice** | Dynamic list | Choose from available TTS voices |
| **Expressiveness** | 0–100% | Vocal emotion/variation |
| **Speaking Rate** | 0.5×–2.0× | Speed of speech |
| **Preview** | Button | Speaks greeting via `/api/voice/synthesize` |

### Persona

- **Personality** — Professional, Friendly, or Technical preset
- **Role** — C-Suite (CEO, CFO, CMO, COO, CPO, CTO) or Specialist (Legal, Compliance, Auditor, Whistleblower)
- **Custom Instructions** — Free-text instructions (max 2000 characters), saved independently from presets

All three (personality, role, custom instructions) are stored separately and combined at runtime.

### Silence Protocol

Threshold slider (40%–85%) controls when Mercury refuses to answer due to low confidence.

---

## Feedback

Submit feedback from the floating widget (bottom-right of dashboard):

- **Categories:** Bug, Feature, General
- **Message:** 10-5000 characters required
- **Screenshot:** Optional attachment
- **Admin panel:** Partners can view all feedback at `/dashboard/admin/feedback`, filter by status/category, and respond

---

*Last updated: March 5, 2026 — Sarah, Engineering, RAGbox.co*
