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

*Last updated: February 21, 2026 — Sarah, Engineering, RAGbox.co*
