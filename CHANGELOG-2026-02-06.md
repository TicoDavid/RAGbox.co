# 2026-02-06 - Sovereign UI Overhaul

## What Was Built

### Dynamic Theme System ("The Chameleon Engine")
- Three operational themes: Midnight Cobalt, Cyber Noir, Forest Dark
- CSS custom properties with `data-theme` attribute switching
- Theme persisted to localStorage
- Real-time theme switching via Settings modal

### Universal Connection Manager
- Dynamic connections array replacing hardcoded API key fields
- CRUD operations for managing multiple AI connections
- Connection verification with visual status indicators
- Migration path from legacy `apiKeys` format

### OpenRouter Gateway ("Universal Skeleton Key")
- OpenRouter as recommended provider for 100+ model access
- Provider dropdown: OpenRouter (Recommended), OpenAI Direct, Custom/Local
- Auto-locked endpoints for preset providers
- Model fetching on verification with cached model list
- Model selector dropdown for switching AI "brains"
- Active model badge displayed in dashboard header

### IngestionModal Transformation ("Scrape Console")
- Dynamic zone: Drop Zone for files, Scrape Console for URLs
- Auto-detect URLs and switch to Website mode
- Three scrape states: idle, processing (with progress), success
- Capture options: Extract Text Only vs Capture as PDF
- Follow Sub-Links toggle (Beta)

### EmptyState Redesign ("Sovereign Intelligence Active")
- RAGbox brand asset as "Reactor Core" with glow effect
- Mission prompts: Forensic Audit, Liability Clauses, Executive Briefing
- Green pulsing "System Ready" status indicator

### Vault Browser Legibility ("Rich Row" Treatment)
- Two-line layout: File name + Date/Size metadata
- Larger icons (w-5 h-5) in colored containers
- Column width increased to 220-260px
- Min-height 56px for touch-friendly rows

### Header Enhancements
- Multi-profile switching (Work/Personal/Consultant)
- Enhanced Privilege button with tooltip and amber glow
- Settings modal with tabbed interface (API Keys, Theme, Notifications)
- Active model badge showing current AI brain

### Cleanup
- Removed dead SettingsGearIcon SVG
- Removed non-functional HardDrive button
- Removed non-functional Pencil button
- Removed duplicate persona selector from ContextBar
- Wired RefreshCw button to clear chat conversation

---

## Files Modified

### New Files
- `src/contexts/SettingsContext.tsx` - Global settings state management
- `src/services/OpenRouterService.ts` - OpenRouter API integration
- `src/app/dashboard/components/IngestionModal.tsx` - Scrape Console modal
- `src/components/dashboard/icons/SovereignIcons.tsx` - Custom icon components
- `src/components/dashboard/vault/VaultExplorer.tsx` - Full-screen vault explorer

### Modified Files
- `src/app/layout.tsx` - Added SettingsProvider wrapper
- `src/components/dashboard/GlobalHeader.tsx` - Settings modal, profiles, model badge
- `src/components/dashboard/DashboardLayout.tsx` - Layout adjustments
- `src/components/dashboard/mercury/ContextBar.tsx` - Removed duplicate persona, wired refresh
- `src/components/dashboard/mercury/EmptyState.tsx` - Sovereign branding rewrite
- `src/components/dashboard/mercury/InputBar.tsx` - Input enhancements
- `src/components/dashboard/vault/BrowserColumn.tsx` - Rich Row styling
- `src/components/dashboard/vault/VaultPanel.tsx` - Header updates
- `src/app/dashboard/components/VaultPanel.tsx` - Panel updates
- `src/stores/vaultStore.ts` - Store additions
- `src/styles/design-tokens.css` - Multi-theme CSS variables
- `tailwind.config.ts` - Config updates
- `CLAUDE.md` - Documentation updates

---

## Test Locally

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev

# Open in browser
open http://localhost:3000

# Login and navigate to dashboard
# Test the following:
```

### Testing Checklist

1. **Theme Switching**
   - Click Settings (gear icon) in header
   - Go to "Theme" tab
   - Click each theme: Cobalt, Noir, Forest
   - Verify colors change across entire UI

2. **OpenRouter Connection**
   - Go to Settings > API Keys tab
   - Click "Open New Gateway"
   - Select "OpenRouter" (should be pre-selected)
   - Enter your OpenRouter API key
   - Click "Test & Fetch Models"
   - Verify model dropdown appears
   - Select a different model
   - Verify model badge appears in header

3. **Ingestion Modal**
   - Click (+) button on Vault panel
   - Verify drop zone for file upload
   - Click "Website" pill
   - Verify Scrape Console appears
   - Enter a URL and press Enter
   - Verify scraping animation

4. **Vault Browser**
   - Verify larger, more legible rows
   - Verify two-line layout (name + metadata)
   - Verify folder/file icons are prominent

5. **Profile Switching**
   - Click avatar in header
   - Switch between Work/Personal/Consultant
   - Verify profile indicator updates in header

---

## Commits

```
898be9e feat: Add OpenRouter Gateway as Universal Skeleton Key
f99020d feat: Sovereign UI overhaul with dynamic themes and Universal Connection Manager
```

---

## Status

- ✅ Deployed to `main` branch
- ✅ Tagged as `v1.0-ui-overhaul`
- ✅ Backup branch: `backup/ui-overhaul-2026-02-06`
- ✅ TypeScript compiles with zero errors
- ✅ Dev server runs successfully on localhost:3000

---

## Architecture Notes

### SettingsContext State Shape
```typescript
interface SettingsState {
  theme: 'cobalt' | 'noir' | 'forest'
  connections: SecureConnection[]
  notifications: NotificationSettings
}

interface SecureConnection {
  id: string
  name: string
  type: 'openrouter' | 'openai' | 'anthropic' | 'google' | 'local' | 'custom'
  endpoint: string
  apiKey: string
  verified: boolean
  createdAt: string
  availableModels?: CachedModel[]  // OpenRouter only
  selectedModel?: string           // OpenRouter only
}
```

### Theme CSS Variables
```css
[data-theme="cobalt"] {
  --bg-primary: #0A192F;
  --brand-blue: #2463EB;
}
[data-theme="noir"] {
  --bg-primary: #000000;
  --brand-blue: #00F0FF;
}
[data-theme="forest"] {
  --bg-primary: #022c22;
  --brand-blue: #10b981;
}
```

### OpenRouter Headers (Required)
```typescript
headers: {
  'Authorization': `Bearer ${apiKey}`,
  'HTTP-Referer': 'https://ragbox.co',
  'X-Title': 'RAGbox',
}
```
