# RAGböx.co® Quick Start Guide

## 🚀 Getting Started

### Step 1: Extract to Your Repo

```powershell
# In your RAGbox.co folder
cd "C:\Users\d0527\RAGbox.co"

# Copy the build plan files
# (Download the ZIP and extract, or copy these files manually)
```

### Step 2: Check Project Status

```powershell
node ralph-v2.js --status
```

This shows:
- Overall progress (stories completed)
- Progress by epic
- Total story points

### Step 3: Get Next Story

```powershell
# See what's next
node ralph-v2.js --dry-run

# Generate the full prompt
node ralph-v2.js
```

### Step 4: Work on Specific Epic

```powershell
# Focus on 5-Tier Security
node ralph-v2.js --epic E7

# Focus on FORGE Templates
node ralph-v2.js --epic E10

# Focus on Mercury Reasoning
node ralph-v2.js --epic E8
```

### Step 5: Mark Story Complete

Edit `RAGbox_stories_v2.json`:
```json
{
  "id": "S002",
  "status": "done",  // Change from "todo" to "done"
  ...
}
```

### Step 6: Commit Progress

```powershell
git add -A
git commit -m "✅ S002: Set Up GCP Project"
git push
```

---

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `node ralph-v2.js` | Get prompt for next story |
| `node ralph-v2.js --dry-run` | Preview next story |
| `node ralph-v2.js --status` | Show project status |
| `node ralph-v2.js --epic E7` | Work on specific epic |

---

## 🎯 Critical Path (Build Order)

**Phase 1: Infrastructure (Week 1-2)**
```
S002 → S003 → S005 → S006
 GCP    Terraform  Auth    Upload
```

**Phase 2: RAG Engine (Week 3-4)**
```
S007 → S008 → S009 → S010 → S011
DocAI    DB    Embed   LLM    RAG
```

**Phase 3: Security (Week 5-6)**
```
S021 → S022 → S024
Tiers   Auto    Filter
```

**Phase 4: Intelligence (Week 7-8)**
```
S026 → S027 → S033 → S036
Reason  Data    OCR    FORGE
```

**Phase 5: Audit (Week 9-10)**
```
S015 → S016 → S017
Audit   View   Export
```

---

## 📁 Files Included

| File | Purpose |
|------|---------|
| `RAGBOX_BUILD_PLAN_V2.md` | Full build plan with architecture |
| `RAGbox_stories_v2.json` | 40 user stories with acceptance criteria |
| `ralph-v2.js` | Agent runner script |
| `ragbox-logo-primary.svg` | Logo (Electric Blue on Black) |
| `ragbox-logo-inverse.svg` | Logo (Electric Blue on White) |
| `ragbox-favicon.svg` | Browser tab icon |
| `ragbox-social-avatar.svg` | Social media avatar |
| `ragbox-og-image.svg` | Open Graph preview image |

---

## 🎨 Logo Assets

Copy the SVG files to your `public/` folder:

```
public/
├── ragbox-logo-primary.svg    # Main logo
├── ragbox-logo-inverse.svg    # For light backgrounds
├── ragbox-favicon.svg         # Browser favicon
├── ragbox-social-avatar.svg   # Social profiles
└── ragbox-og-image.svg        # Link previews
```

---

## 📞 Support

For implementation questions, paste the Ralph Wiggum prompt into Claude.ai or Claude Code. The prompt includes all context needed for each story.

---

**"Your Files Speak. We Make Them Testify."**

RAGböx.co®
