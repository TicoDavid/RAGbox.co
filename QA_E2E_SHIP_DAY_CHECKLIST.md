# DR. INSANE — REVIEW 16: E2E SHIP DAY VERIFICATION

**Reviewer:** Dr. Insane, QA Lead — RAGböx
**Date:** 2026-02-19 (Day 3 — SHIP DAY)
**Executor:** David (CPO) — manual browser walkthrough
**Target:** https://app.ragbox.co
**Precondition:** Deploy 4 has landed. All services healthy.

---

## INSTRUCTIONS

Print this page. Open https://app.ragbox.co in Chrome (incognito).
Check each box as you go. Write FAIL next to anything broken.
Stop immediately if any **BLOCKER** step fails.

---

## PHASE 1: LOGIN + DASHBOARD INTEGRITY

### TEST 1 — Login and Dashboard Load
```
URL: https://app.ragbox.co
```
- [ ] 1.1 — Login page renders (no white screen, no console errors)
- [ ] 1.2 — Sign in with your account
- [ ] 1.3 — Dashboard loads within 3 seconds
- [ ] 1.4 — **Cobalt theme active by default** — background is dark navy (`#0A192F`), accent is blue (`#2463EB`)
- [ ] 1.5 — No flash of unstyled content (FOUC) during load
- [ ] 1.6 — `M.E.R.C.U.R.Y.` header text visible in top bar
- [ ] 1.7 — **BLOCKER** if dashboard doesn't load

**Ship Criteria:** #8 Theme Consistency

---

## PHASE 2: SYSTEM CONTROL PANEL (SCP)

### TEST 2 — SCP Opens via Gear Icon
- [ ] 2.1 — Click the **gear icon** (Settings) in the top-right header area
- [ ] 2.2 — SCP modal opens with title: **"System Control Panel"**
- [ ] 2.3 — Subtitle reads: **"Sovereign Configuration Engine"**
- [ ] 2.4 — Left sidebar shows 5 categories: **General, Intelligence, Interface, System, Support**
- [ ] 2.5 — Default section on open is **Connections**

**Ship Criteria:** #11 SCP Modal

### TEST 3 — Navigate All SCP Sections
Click each item in the sidebar. Confirm it loads without error.

| Category | Item | Loads? |
|----------|------|--------|
| General | Profile | [ ] |
| General | Language | [ ] |
| General | Plan & Usage | [ ] |
| Intelligence | Connections | [ ] |
| Intelligence | Voice | [ ] |
| Intelligence | AI Model | [ ] |
| Interface | Appearance | [ ] |
| Interface | Density | [ ] |
| System | Alerts | [ ] |
| System | Security | [ ] |
| Support | Documentation | [ ] |
| Support | Report Issue | [ ] |
| Support | Community | [ ] |

- [ ] 3.1 — All 13 sections load without blank screens or console errors
- [ ] 3.2 — **BLOCKER** if any section crashes

**Ship Criteria:** #11 SCP Modal

### TEST 4 — Connections: OpenRouter Config Visible
```
SCP > Intelligence > Connections
```
- [ ] 4.1 — BYOLLM configuration section is visible
- [ ] 4.2 — Provider shows **"openrouter"** (or configured provider)
- [ ] 4.3 — API key is **MASKED** — displays format like `sk-or***234` (first 5 + *** + last 3)
- [ ] 4.4 — **Raw API key is NOT visible anywhere** on this screen
- [ ] 4.5 — Base URL shows (if configured) or defaults to OpenRouter
- [ ] 4.6 — Default model is displayed
- [ ] 4.7 — Help text panel visible with security reassurance ("Your key is safe")
- [ ] 4.8 — **BLOCKER** if raw key is exposed — this is a **SECURITY FAILURE**

**Ship Criteria:** #1 BYOLLM E2E, #5 Key Never Exposed

### TEST 5 — AI Model: Policy Selector
```
SCP > Intelligence > AI Model
```
- [ ] 5.1 — Policy selector is visible with 3 options
- [ ] 5.2 — **"User's Choice"** (`choice`) — selectable
- [ ] 5.3 — **"Private LLM Only"** (`byollm_only`) — selectable
- [ ] 5.4 — **"AEGIS Only"** (`aegis_only`) — selectable
- [ ] 5.5 — Switching between policies saves without error
- [ ] 5.6 — **Set policy back to "User's Choice" before continuing**

**Ship Criteria:** #3 Policy Enforcement

---

## PHASE 3: THEMES

### TEST 6 — Switch All 4 Themes
```
SCP > Interface > Appearance
```

| Theme | Background | Accent | Check |
|-------|-----------|--------|-------|
| **Midnight Cobalt** | Dark navy `#0A192F` | Blue `#2463EB` | [ ] |
| **Cyber Noir** | Pure black `#000000` | Cyan `#00F0FF` | [ ] |
| **Forest Dark** | Dark green `#022c22` | Emerald `#10b981` | [ ] |
| **Obsidian Gold** | Near-black `#020408` | Gold/Amber `#D97706` | [ ] |

- [ ] 6.1 — Each theme applies **immediately** (no reload needed)
- [ ] 6.2 — Left rail updates to match theme accent
- [ ] 6.3 — Right rail updates to match theme accent
- [ ] 6.4 — Chat area background updates
- [ ] 6.5 — SCP modal itself re-themes
- [ ] 6.6 — Header/top bar re-themes
- [ ] 6.7 — **Set theme back to Cobalt before continuing**

**Ship Criteria:** #8 Theme Consistency, #9 Zero Hardcoded Colors

### TEST 7 — Close SCP
- [ ] 7.1 — Close the SCP modal (X button or click outside)
- [ ] 7.2 — Modal closes cleanly, dashboard is fully visible
- [ ] 7.3 — Theme persists after modal close (still Cobalt)

---

## PHASE 4: NAVIGATION RAILS

### TEST 8 — Left Rail: Icons Only + Tooltips
```
Left side of dashboard (collapsed state)
```
- [ ] 8.1 — Left rail shows **icons only** (no text labels)
- [ ] 8.2 — Hover over each icon — **tooltip appears**:

| Icon | Expected Tooltip | Tooltip Shows? |
|------|-----------------|---------------|
| Box | "Vault" | [ ] |
| Clock | "Recent Files" | [ ] |
| Star | "Starred" | [ ] |
| Plus Circle | "Add to Vault" | [ ] |

- [ ] 8.3 — Active icon has **blue glow indicator** on left edge
- [ ] 8.4 — No hardcoded color on hover — uses theme accent (`var(--brand-blue)`)

**Ship Criteria:** #10 Icon Rail

### TEST 9 — Right Rail: Required Icons Present
```
Right side of dashboard (collapsed state)
```
- [ ] 9.1 — **Intelligence** icon (Lightbulb) present with tooltip
- [ ] 9.2 — **My Agent** icon (UserCircle) present with tooltip
- [ ] 9.3 — **Truth & Audit** icon (Scale) present with tooltip
- [ ] 9.4 — **Mercury** icon (Mic) present
- [ ] 9.5 — **Studio** icon (Sparkles) present
- [ ] 9.6 — **Export** icon (Download) present
- [ ] 9.7 — **WhatsApp** icon (MessageCircle) present
- [ ] 9.8 — Each icon shows tooltip on hover
- [ ] 9.9 — Active icon has **blue glow indicator** on right edge

**Ship Criteria:** #10 Icon Rail

### TEST 10 — Avatar Dropdown: Exactly 3 Items
```
Top-right corner — click avatar/chevron
```
- [ ] 10.1 — Dropdown opens showing user name + email at top
- [ ] 10.2 — **Profile** menu item present (User icon)
- [ ] 10.3 — **Plan & Usage** menu item present (CreditCard icon)
- [ ] 10.4 — **Sign Out** menu item present (LogOut icon)
- [ ] 10.5 — **ONLY these 3 items** — no other entries
- [ ] 10.6 — Profile click opens SCP to Profile section
- [ ] 10.7 — Plan & Usage click opens SCP to Plan section
- [ ] 10.8 — Close dropdown (click away, don't sign out)

### TEST 11 — Phone Icon: GONE
- [ ] 11.1 — Scan the **entire header bar** — no phone icon anywhere
- [ ] 11.2 — Scan the **left rail** — no phone icon
- [ ] 11.3 — Scan the **right rail** — no phone icon (Mic is microphone, NOT phone)
- [ ] 11.4 — **CONFIRMED: Phone icon is absent from the UI**

**Ship Criteria:** #15 Dead Infra Gone

---

## PHASE 5: BYOLLM + MODEL BADGE

### TEST 12 — Chat with BYOLLM Model
```
Prerequisite: Policy is set to "User's Choice" (from Test 5)
Main chat area
```
- [ ] 12.1 — **ChatModelPicker** toggle visible above chat input (sliding pill: AEGIS | [Model Name])
- [ ] 12.2 — Select **BYOLLM side** of the toggle (shows provider abbreviation + model name)
- [ ] 12.3 — Toggle pill slides to BYOLLM side with **brand-blue** color and Key icon
- [ ] 12.4 — Type a question about vault documents: **"What are the key terms in the NDA?"**
- [ ] 12.5 — Send the message
- [ ] 12.6 — Response streams in (SSE) without error
- [ ] 12.7 — **BLOCKER** if response fails or shows "Authentication required"

**Ship Criteria:** #1 BYOLLM E2E

### TEST 13 — Model Badge on BYOLLM Response
```
Look at the footer of the assistant's response message
```
- [ ] 13.1 — **Model badge visible** below the response text
- [ ] 13.2 — Badge shows lock icon: **"[lock] {model-name}"** (e.g., `anthropic/claude-sonnet-4-20250514`)
- [ ] 13.3 — Badge color is **amber/gold** (`--privilege-confidential`), NOT blue
- [ ] 13.4 — **Latency displayed** in format: `· X.Xs` (e.g., `· 1.2s`)
- [ ] 13.5 — **Confidence score** visible (e.g., `0.91`)
- [ ] 13.6 — Timestamp shown (HH:MM AM/PM format)

**Ship Criteria:** #2 Model Badge, #6 Audit Trail (SSE metadata)

### TEST 14 — Switch to AEGIS + Compare
- [ ] 14.1 — Click the **ChatModelPicker** toggle back to **AEGIS** side
- [ ] 14.2 — Toggle shows **amber** color with ShieldCheck icon and "AEGIS" label
- [ ] 14.3 — Send the **same question**: "What are the key terms in the NDA?"
- [ ] 14.4 — Response streams in successfully
- [ ] 14.5 — Model badge shows: **"[lightning] AEGIS"** in **brand-blue** color
- [ ] 14.6 — Latency displayed (likely faster than BYOLLM, e.g., `· 0.8s`)
- [ ] 14.7 — Confidence score visible
- [ ] 14.8 — **Both responses reference the same document/chunks** (same citations)

**Ship Criteria:** #1 BYOLLM E2E, #2 Model Badge, #7 Mercury Voice (chat pipeline)

---

## PHASE 6: INTELLIGENCE + SILENCE PROTOCOL

### TEST 15 — Vault File List Query
```
In the chat input
```
- [ ] 15.1 — Type: **"What files are in my vault?"**
- [ ] 15.2 — Send the message
- [ ] 15.3 — Response returns a **file list** (document names from your vault)
- [ ] 15.4 — Response does **NOT** trigger Silence Protocol (no "I don't have enough information" deflection)
- [ ] 15.5 — Tool router correctly matched this as `list_documents` intent

**Ship Criteria:** #12 Tool Router

### TEST 16 — Document Count Query
- [ ] 16.1 — Type: **"How many documents do I have?"**
- [ ] 16.2 — Send the message
- [ ] 16.3 — Response returns a **count** or list with count
- [ ] 16.4 — Response does **NOT** trigger Silence Protocol
- [ ] 16.5 — Response is coherent and accurate

**Ship Criteria:** #12 Tool Router

---

## PHASE 7: CHAT MANAGEMENT

### TEST 17 — Clear Chat + Reload Persistence
- [ ] 17.1 — Clear the current chat (clear button or equivalent)
- [ ] 17.2 — Chat area is empty
- [ ] 17.3 — **Reload the page** (F5 or Ctrl+R)
- [ ] 17.4 — After reload, cleared messages are **GONE** (not restored)
- [ ] 17.5 — Dashboard loads cleanly after reload

### TEST 18 — New Chat Thread
- [ ] 18.1 — Click the **New Chat (+)** button
- [ ] 18.2 — Fresh empty thread starts
- [ ] 18.3 — No messages from previous conversation visible
- [ ] 18.4 — Chat input is focused and ready

### TEST 19 — Recent Threads (Clock Icon)
- [ ] 19.1 — Click the **Clock icon** in the left rail
- [ ] 19.2 — Recent threads dropdown/panel appears
- [ ] 19.3 — Shows history of previous conversations
- [ ] 19.4 — Click a previous thread — it loads correctly
- [ ] 19.5 — Messages from that thread are restored

### TEST 20 — Export
- [ ] 20.1 — Click the **Export (Download)** icon in the right rail
- [ ] 20.2 — Export panel opens with 3 options: Conversation, Audit Trail, Vault Data
- [ ] 20.3 — Click **"Export Conversation"**
- [ ] 20.4 — PDF downloads successfully (file: `ragbox_conversation_{date}.pdf`)
- [ ] 20.5 — Open the PDF — contains conversation content

---

## PHASE 8: WHATSAPP

### TEST 21 — WhatsApp Tab
- [ ] 21.1 — Click the **WhatsApp (MessageCircle)** icon in the right rail
- [ ] 21.2 — WhatsApp panel opens
- [ ] 21.3 — Conversation list loads (may be empty if no WhatsApp configured)
- [ ] 21.4 — Panel renders without errors
- [ ] 21.5 — AI reply toggle visible (if conversations exist)

---

## PHASE 9: HARDCODED COLOR SPOT CHECK

### TEST 22 — Theme Sweep: 5 Component Spot Check
```
Repeat for each of the 4 themes: Cobalt, Noir, Forest, Obsidian
Open DevTools (F12) > Elements tab for inspection
```

**For EACH theme, verify these 5 components use CSS variables (not hex literals):**

| # | Component | What to Check | Cobalt | Noir | Forest | Obsidian |
|---|-----------|--------------|--------|------|--------|----------|
| A | **Left rail active indicator** | Glow uses `var(--brand-blue)` not hardcoded hex | [ ] | [ ] | [ ] | [ ] |
| B | **Chat input border on focus** | Border uses `var(--brand-blue)` or theme variable | [ ] | [ ] | [ ] | [ ] |
| C | **Model badge background** | Uses `var(--privilege-confidential)` or `var(--brand-blue)` | [ ] | [ ] | [ ] | [ ] |
| D | **SCP sidebar active item** | Highlight uses theme variable | [ ] | [ ] | [ ] | [ ] |
| E | **Avatar dropdown background** | Uses `var(--bg-secondary)` or `var(--bg-tertiary)` | [ ] | [ ] | [ ] | [ ] |

- [ ] 22.1 — **Cobalt:** All 5 components use theme variables
- [ ] 22.2 — **Noir:** All 5 components re-theme to cyan accent
- [ ] 22.3 — **Forest:** All 5 components re-theme to emerald accent
- [ ] 22.4 — **Obsidian:** All 5 components re-theme to gold accent
- [ ] 22.5 — **NO hardcoded hex values found** (especially watch for `#0A192F`, `#2463EB`, or any Cobalt-specific colors baked in)
- [ ] 22.6 — StealthRails background uses `var(--bg-primary)`, **NOT** `bg-[#0A192F]` (Review 15 fix)

**Ship Criteria:** #9 Zero Hardcoded Colors

---

## RESULTS SUMMARY

Fill in after completing all tests:

| Phase | Tests | Pass | Fail | Blocker? |
|-------|-------|------|------|----------|
| 1. Login + Dashboard | 1.1–1.7 | __ /7 | | |
| 2. SCP | 2.1–5.6 | __ /24 | | |
| 3. Themes | 6.1–7.3 | __ /10 | | |
| 4. Navigation Rails | 8.1–11.4 | __ /21 | | |
| 5. BYOLLM + Badge | 12.1–14.8 | __ /21 | | |
| 6. Intelligence | 15.1–16.5 | __ /10 | | |
| 7. Chat Management | 17.1–20.5 | __ /14 | | |
| 8. WhatsApp | 21.1–21.5 | __ /5 | | |
| 9. Hardcoded Colors | 22.1–22.6 | __ /6 | | |
| **TOTAL** | **118 checks** | __ /118 | | |

---

## SHIP CRITERIA TRACEABILITY

Every ship criterion maps to at least one test:

| # | Ship Criterion | Covered By Tests |
|---|---------------|-----------------|
| 1 | BYOLLM end-to-end | 4, 12, 13, 14 |
| 2 | Model badge | 13, 14 |
| 3 | Policy enforcement | 5 |
| 4 | KMS encryption real | 4 (masked key proves encryption) |
| 5 | Key never exposed | 4.4, 4.8 |
| 6 | Audit trail | 13.5, 14.7 (confidence in SSE) |
| 7 | Mercury voice | 12, 14 (chat pipeline functional) |
| 8 | Theme consistency | 6 |
| 9 | Zero hardcoded colors | 22 |
| 10 | Icon rail | 8, 9 |
| 11 | SCP modal | 2, 3 |
| 12 | Tool router | 15, 16 |
| 13 | Tests green | (Verified by ADAM's deploy — not in browser test) |
| 14 | Documentation | (Verified by Review 22 — not in browser test) |
| 15 | Dead infra gone | 11 |

---

## BLOCKER DEFINITIONS

If ANY of these fail, **STOP and report to Dr. Insane immediately:**

| Test | Blocker Condition |
|------|------------------|
| 1.7 | Dashboard doesn't load at all |
| 3.2 | Any SCP section crashes |
| 4.8 | Raw API key visible (SECURITY FAILURE) |
| 12.7 | BYOLLM chat fails entirely |

---

## SIGN-OFF

```
Tested by: David (CPO)
Date: _______________
Time started: _______________
Time completed: _______________

Total PASS: _____ / 118
Total FAIL: _____
Blockers found: _____

Signature: _________________________
```

**Return this completed checklist to Dr. Insane for Review 16 verdict.**

---

*Prepared by Dr. Insane, QA Lead — RAGböx*
*"Nothing ships without my stamp."*
