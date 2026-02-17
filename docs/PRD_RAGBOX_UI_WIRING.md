# PRD: RAGbox.co UI Wiring & Embedding Pipeline
## Version 1.0 | February 12, 2026

---

## Executive Summary

**Problem:** Documents upload successfully but never get vectorized. The embedding pipeline exists but is never called, leaving all documents with "Pending" status and "RAG Disabled." Mercury cannot answer questions because the vector database is empty.

**Solution:** Connect the upload → extraction → embedding pipeline and wire all UI elements to functional backend endpoints. Zero placeholders.

**Success Criteria:** Upload a PDF → status changes to "Indexed" within 60 seconds → ask Mercury a question → receive cited answer.

---

## Architecture Context

```
CURRENT BROKEN FLOW:
Upload → GCS → Document AI → [DEAD END] → Documents stuck "Pending"

FIXED FLOW:
Upload → GCS → Document AI → indexDocument() → pgvector → Mercury can query
```

**Tech Stack Reference:**
- Frontend: Next.js 14, TypeScript, Zustand
- Backend: Next.js API Routes
- Database: PostgreSQL 18 + pgvector (Prisma ORM)
- AI: Vertex AI Gemini 1.5 Pro + text-embedding-005
- Storage: GCP Cloud Storage

---

## TASK QUEUE

Execute tasks sequentially. Each task is atomic and independently deployable.
Format: `[TASK-XX]` → Status → Estimated time → Dependencies

---

### PHASE 1: EMBEDDING PIPELINE (Critical Path)

#### [TASK-01] Connect Extract Route to Indexer
**Status:** NOT STARTED  
**Time:** 15 min  
**Dependencies:** None  
**Risk:** LOW

**File:** `src/app/api/documents/extract/route.ts`

**Change:** After document creation with extracted text, trigger async indexing.

**Find this pattern:**
```typescript
// After prisma.document.create() or update() with extractedText
```

**Add after it:**
```typescript
import { indexDocument } from '@/lib/rag/indexer'

// Trigger background indexing (non-blocking)
if (extractedText && extractedText.length > 0) {
  indexDocument(document.id, extractedText)
    .then(result => console.log(`[Extract] Indexed ${document.id}: ${result.chunkCount} chunks`))
    .catch(err => console.error(`[Extract] Index failed for ${document.id}:`, err))
}
```

**Validation:**
```bash
# Upload a test PDF via UI
# Check Cloud Run logs for "[Extract] Indexed" message
# Query: SELECT index_status FROM documents WHERE id = '<doc_id>';
# Expected: 'Indexed'
```

**Rollback:** Remove the indexDocument import and call.

---

#### [TASK-02] Create Manual Vectorize Endpoint
**Status:** NOT STARTED  
**Time:** 20 min  
**Dependencies:** None  
**Risk:** LOW

**File:** `src/app/api/documents/[id]/vectorize/route.ts` (NEW)

**Create:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { indexDocument } from '@/lib/rag/indexer'
import { logAuditEvent } from '@/lib/audit/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const document = await prisma.document.findFirst({
      where: { 
        id: params.id, 
        userId: session.user.id,
        deletionStatus: 'Active',
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (!document.extractedText || document.extractedText.length === 0) {
      return NextResponse.json({ 
        error: 'No extracted text available. Re-upload the document.' 
      }, { status: 400 })
    }

    const result = await indexDocument(document.id, document.extractedText)

    await logAuditEvent({
      userId: session.user.id,
      action: 'DOCUMENT_VECTORIZED',
      resourceType: 'document',
      resourceId: document.id,
      details: { chunkCount: result.chunkCount, status: result.status },
    })

    return NextResponse.json({ 
      success: true, 
      documentId: result.documentId,
      chunkCount: result.chunkCount,
      status: result.status,
    })
  } catch (error) {
    console.error('[Vectorize] Error:', error)
    return NextResponse.json({ 
      error: 'Vectorization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
```

**Validation:**
```bash
curl -X POST https://ragbox-app-100739220279.us-east4.run.app/api/documents/<DOC_ID>/vectorize \
  -H "Cookie: <session_cookie>"
# Expected: {"success":true,"chunkCount":N,"status":"Indexed"}
```

**Rollback:** Delete the file.

---

#### [TASK-03] Create Batch Re-index Endpoint
**Status:** NOT STARTED  
**Time:** 20 min  
**Dependencies:** None  
**Risk:** LOW

**File:** `src/app/api/documents/reindex/route.ts` (NEW)

**Create:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { indexDocument } from '@/lib/rag/indexer'
import { logAuditEvent } from '@/lib/audit/logger'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find all documents needing indexing
    const documents = await prisma.document.findMany({
      where: {
        userId: session.user.id,
        indexStatus: { in: ['Pending', 'Failed'] },
        extractedText: { not: null },
        deletionStatus: 'Active',
      },
      select: { 
        id: true, 
        filename: true, 
        extractedText: true,
      },
    })

    if (documents.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No documents need indexing',
        processed: 0,
        results: [],
      })
    }

    const results: Array<{
      id: string
      filename: string
      status: string
      chunkCount?: number
      error?: string
    }> = []

    for (const doc of documents) {
      try {
        const result = await indexDocument(doc.id, doc.extractedText!)
        results.push({ 
          id: doc.id, 
          filename: doc.filename, 
          status: result.status,
          chunkCount: result.chunkCount,
        })
      } catch (error) {
        results.push({ 
          id: doc.id, 
          filename: doc.filename, 
          status: 'Failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    await logAuditEvent({
      userId: session.user.id,
      action: 'BATCH_REINDEX',
      resourceType: 'system',
      resourceId: 'batch',
      details: { 
        totalProcessed: results.length,
        successful: results.filter(r => r.status === 'Indexed').length,
        failed: results.filter(r => r.status === 'Failed').length,
      },
    })

    return NextResponse.json({ 
      success: true, 
      processed: results.length,
      successful: results.filter(r => r.status === 'Indexed').length,
      failed: results.filter(r => r.status === 'Failed').length,
      results,
    })
  } catch (error) {
    console.error('[Reindex] Batch error:', error)
    return NextResponse.json({ error: 'Batch reindex failed' }, { status: 500 })
  }
}
```

**Validation:**
```bash
curl -X POST https://ragbox-app-100739220279.us-east4.run.app/api/documents/reindex \
  -H "Cookie: <session_cookie>"
# Expected: {"success":true,"processed":N,"successful":N,...}
```

**Rollback:** Delete the file.

---

#### [TASK-04] Create Delete Embeddings Endpoint
**Status:** NOT STARTED  
**Time:** 15 min  
**Dependencies:** None  
**Risk:** LOW

**File:** `src/app/api/documents/[id]/embeddings/route.ts` (NEW)

**Create:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit/logger'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const document = await prisma.document.findFirst({
      where: { id: params.id, userId: session.user.id },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Delete all chunks (embeddings)
    const deleted = await prisma.documentChunk.deleteMany({
      where: { documentId: params.id },
    })

    // Reset document index status
    await prisma.document.update({
      where: { id: params.id },
      data: { 
        indexStatus: 'Pending', 
        chunkCount: 0,
      },
    })

    await logAuditEvent({
      userId: session.user.id,
      action: 'EMBEDDINGS_DELETED',
      resourceType: 'document',
      resourceId: params.id,
      details: { chunksDeleted: deleted.count },
    })

    return NextResponse.json({ 
      success: true, 
      chunksDeleted: deleted.count,
    })
  } catch (error) {
    console.error('[Embeddings] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete embeddings' }, { status: 500 })
  }
}
```

**Validation:**
```bash
curl -X DELETE https://ragbox-app-100739220279.us-east4.run.app/api/documents/<DOC_ID>/embeddings \
  -H "Cookie: <session_cookie>"
# Expected: {"success":true,"chunksDeleted":N}
```

**Rollback:** Delete the file.

---

### PHASE 2: TOOLBAR BUTTONS

#### [TASK-05] Wire Vectorize Toolbar Button
**Status:** NOT STARTED  
**Time:** 20 min  
**Dependencies:** TASK-02, TASK-03  
**Risk:** LOW

**File:** `src/components/dashboard/vault/VaultPanel.tsx` (or toolbar component)

**Find:** The toolbar containing Upload, Vectorize buttons

**Add/Modify:**
```typescript
const [isVectorizing, setIsVectorizing] = useState(false)

const handleVectorize = async () => {
  setIsVectorizing(true)
  try {
    const selectedIds = useVaultStore.getState().selectedDocumentIds
    
    if (selectedIds && selectedIds.length > 0) {
      // Vectorize selected documents
      for (const id of selectedIds) {
        await fetch(`/api/documents/${id}/vectorize`, { method: 'POST' })
      }
    } else {
      // Batch re-index all pending
      await fetch('/api/documents/reindex', { method: 'POST' })
    }
    
    // Refresh document list
    await fetchDocuments()
  } catch (error) {
    console.error('Vectorization failed:', error)
  } finally {
    setIsVectorizing(false)
  }
}

// In JSX:
<button 
  onClick={handleVectorize}
  disabled={isVectorizing}
  className="flex items-center gap-2 px-3 py-1.5 ..."
>
  <BrainCog className={cn("w-4 h-4", isVectorizing && "animate-spin")} />
  {isVectorizing ? 'Vectorizing...' : 'Vectorize'}
</button>
```

**Validation:**
1. Click Vectorize with no selection → batch re-indexes all pending
2. Select documents, click Vectorize → indexes only selected
3. Status changes from "Pending" to "Indexed"

**Rollback:** Revert to placeholder onClick.

---

#### [TASK-06] Wire New Folder Button
**Status:** NOT STARTED  
**Time:** 15 min  
**Dependencies:** None  
**Risk:** LOW

**File:** `src/components/dashboard/vault/VaultPanel.tsx`

**Find:** The "+ New" button

**Add/Modify:**
```typescript
const [showNewFolderModal, setShowNewFolderModal] = useState(false)
const [newFolderName, setNewFolderName] = useState('')

const handleCreateFolder = async () => {
  if (!newFolderName.trim()) return
  
  try {
    const currentFolderId = currentPath[currentPath.length - 1] || null
    
    const response = await fetch('/api/documents/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: newFolderName.trim(), 
        parentId: currentFolderId,
      }),
    })
    
    if (response.ok) {
      setShowNewFolderModal(false)
      setNewFolderName('')
      await fetchFolders()
    }
  } catch (error) {
    console.error('Failed to create folder:', error)
  }
}

// In JSX:
<button onClick={() => setShowNewFolderModal(true)} className="...">
  <Plus className="w-4 h-4" />
  New
</button>

{showNewFolderModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-[var(--bg-secondary)] rounded-lg p-6 w-96">
      <h3 className="text-lg font-semibold mb-4">Create New Folder</h3>
      <input
        type="text"
        value={newFolderName}
        onChange={(e) => setNewFolderName(e.target.value)}
        placeholder="Folder name"
        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg mb-4"
        autoFocus
      />
      <div className="flex gap-2 justify-end">
        <button onClick={() => setShowNewFolderModal(false)} className="px-4 py-2 ...">
          Cancel
        </button>
        <button onClick={handleCreateFolder} className="px-4 py-2 bg-[var(--brand-blue)] ...">
          Create
        </button>
      </div>
    </div>
  </div>
)}
```

**Validation:** Click "+ New" → modal appears → enter name → folder created

**Rollback:** Remove modal and handler.

---

#### [TASK-07] Wire Move To Button
**Status:** NOT STARTED  
**Time:** 25 min  
**Dependencies:** None  
**Risk:** LOW

**File:** `src/components/dashboard/vault/VaultPanel.tsx`

**Add to vaultStore if missing:**
```typescript
// In src/stores/vaultStore.ts
selectedDocumentIds: string[]
setSelectedDocumentIds: (ids: string[]) => void
toggleDocumentSelection: (id: string) => void
```

**Add to VaultPanel:**
```typescript
const [showMoveModal, setShowMoveModal] = useState(false)
const selectedDocumentIds = useVaultStore((s) => s.selectedDocumentIds)

const handleMoveDocuments = async (targetFolderId: string | null) => {
  try {
    for (const docId of selectedDocumentIds) {
      await fetch(`/api/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: targetFolderId }),
      })
    }
    setShowMoveModal(false)
    useVaultStore.getState().setSelectedDocumentIds([])
    await fetchDocuments()
  } catch (error) {
    console.error('Move failed:', error)
  }
}

// Button:
<button 
  onClick={() => setShowMoveModal(true)}
  disabled={selectedDocumentIds.length === 0}
  className="..."
>
  <FolderInput className="w-4 h-4" />
  Move To
</button>
```

**Create endpoint if missing:** `src/app/api/documents/[id]/route.ts` PATCH handler

**Validation:** Select documents → click Move To → select folder → documents move

**Rollback:** Remove modal and handler.

---

#### [TASK-08] Wire Security Button
**Status:** NOT STARTED  
**Time:** 20 min  
**Dependencies:** None  
**Risk:** LOW

**File:** `src/components/dashboard/vault/VaultPanel.tsx`

**Add:**
```typescript
const [showSecurityModal, setShowSecurityModal] = useState(false)

const handleBulkSecurityChange = async (tier: number, isPrivileged: boolean) => {
  try {
    for (const docId of selectedDocumentIds) {
      await fetch(`/api/documents/${docId}/tier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ securityTier: tier }),
      })
      
      if (isPrivileged) {
        await fetch(`/api/documents/${docId}/privilege`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPrivileged: true }),
        })
      }
    }
    setShowSecurityModal(false)
    await fetchDocuments()
  } catch (error) {
    console.error('Security update failed:', error)
  }
}

// Button:
<button onClick={() => setShowSecurityModal(true)} className="...">
  <Shield className="w-4 h-4" />
  Security
</button>
```

**Validation:** Select documents → click Security → choose tier → all documents updated

**Rollback:** Remove modal and handler.

---

### PHASE 3: DOCUMENT INSPECTOR PANEL

#### [TASK-09] Wire "Chat with this File" Button
**Status:** NOT STARTED  
**Time:** 15 min  
**Dependencies:** None  
**Risk:** LOW

**File:** `src/components/dashboard/vault/DocumentInspector.tsx` or `PreviewPane.tsx`

**Find:** The blue "Chat with this File" button

**Wire:**
```typescript
const selectAndChat = useVaultStore((s) => s.selectAndChat)
const setActivePanel = useMercuryStore((s) => s.setActivePanel)

const handleChatWithFile = () => {
  if (!selectedDocument) return
  
  // Set document as context for Mercury
  selectAndChat(selectedDocument.id)
  
  // Switch to Mercury panel
  setActivePanel?.('mercury')
}

// Button:
<button 
  onClick={handleChatWithFile}
  disabled={selectedDocument?.indexStatus !== 'Indexed'}
  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--brand-blue)] ..."
>
  <MessageSquare className="w-4 h-4" />
  Chat with this File
</button>
```

**Validation:** Select indexed document → click button → Mercury opens with document context

**Rollback:** Revert to placeholder.

---

#### [TASK-10] Wire RAG Disabled Toggle
**Status:** NOT STARTED  
**Time:** 20 min  
**Dependencies:** TASK-02, TASK-04  
**Risk:** LOW

**File:** `src/components/dashboard/vault/DocumentInspector.tsx`

**Find:** The RAG Disabled toggle in INTELLIGENCE CONTROLS

**Wire:**
```typescript
const [isTogglingRAG, setIsTogglingRAG] = useState(false)

const handleRAGToggle = async (enabled: boolean) => {
  if (!selectedDocument) return
  setIsTogglingRAG(true)
  
  try {
    if (enabled) {
      // Enable RAG = vectorize document
      await fetch(`/api/documents/${selectedDocument.id}/vectorize`, { 
        method: 'POST' 
      })
    } else {
      // Disable RAG = delete embeddings
      await fetch(`/api/documents/${selectedDocument.id}/embeddings`, { 
        method: 'DELETE' 
      })
    }
    await fetchDocuments()
  } catch (error) {
    console.error('RAG toggle failed:', error)
  } finally {
    setIsTogglingRAG(false)
  }
}

// Toggle:
<div className="flex items-center justify-between">
  <span>RAG {selectedDocument?.indexStatus === 'Indexed' ? 'Enabled' : 'Disabled'}</span>
  <button
    onClick={() => handleRAGToggle(selectedDocument?.indexStatus !== 'Indexed')}
    disabled={isTogglingRAG || !selectedDocument?.extractedText}
    className={cn(
      "relative w-12 h-6 rounded-full transition-colors",
      selectedDocument?.indexStatus === 'Indexed' 
        ? "bg-emerald-500" 
        : "bg-slate-600"
    )}
  >
    <div className={cn(
      "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
      selectedDocument?.indexStatus === 'Indexed' ? "left-7" : "left-1"
    )} />
  </button>
</div>
```

**Validation:** 
- Toggle ON → document gets vectorized → status changes to Indexed
- Toggle OFF → embeddings deleted → status changes to Pending

**Rollback:** Revert to static display.

---

#### [TASK-11] Wire Verify Integrity Button
**Status:** NOT STARTED  
**Time:** 25 min  
**Dependencies:** None  
**Risk:** LOW

**File:** `src/app/api/documents/[id]/verify/route.ts` (NEW)

**Create endpoint:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Storage } from '@google-cloud/storage'
import crypto from 'crypto'

const storage = new Storage()
const BUCKET = process.env.GCS_BUCKET_NAME || 'ragbox-documents'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const document = await prisma.document.findFirst({
      where: { id: params.id, userId: session.user.id },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (!document.storagePath) {
      return NextResponse.json({ 
        valid: false, 
        error: 'No file stored' 
      })
    }

    // Download file and compute hash
    const [buffer] = await storage
      .bucket(BUCKET)
      .file(document.storagePath)
      .download()
    
    const computedHash = crypto
      .createHash('sha256')
      .update(buffer)
      .digest('hex')

    const isValid = computedHash === document.checksum

    return NextResponse.json({
      valid: isValid,
      storedHash: document.checksum,
      computedHash: computedHash,
      filename: document.filename,
      verifiedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Verify] Error:', error)
    return NextResponse.json({ 
      valid: false, 
      error: 'Verification failed' 
    }, { status: 500 })
  }
}
```

**Wire in UI:**
```typescript
const handleVerifyIntegrity = async () => {
  if (!selectedDocument) return
  
  const response = await fetch(`/api/documents/${selectedDocument.id}/verify`, {
    method: 'POST',
  })
  const data = await response.json()
  
  if (data.valid) {
    alert('✓ Document integrity verified. Hash matches original.')
  } else {
    alert(`⚠ Warning: Document integrity check failed.\nStored: ${data.storedHash}\nComputed: ${data.computedHash}`)
  }
}
```

**Validation:** Click Verify Integrity → shows pass/fail result

**Rollback:** Delete endpoint, revert button.

---

#### [TASK-12] Wire Security Classification Dropdown
**Status:** NOT STARTED  
**Time:** 15 min  
**Dependencies:** None  
**Risk:** LOW

**File:** `src/components/dashboard/vault/DocumentInspector.tsx`

**Wire:**
```typescript
const securityTiers = [
  { value: 0, label: 'General', color: 'emerald' },
  { value: 1, label: 'Confidential', color: 'amber' },
  { value: 2, label: 'Privileged', color: 'red' },
]

const handleSecurityChange = async (tier: number) => {
  if (!selectedDocument) return
  
  await fetch(`/api/documents/${selectedDocument.id}/tier`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ securityTier: tier }),
  })
  
  await fetchDocuments()
}

// Dropdown:
<select
  value={selectedDocument?.securityTier || 0}
  onChange={(e) => handleSecurityChange(parseInt(e.target.value))}
  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg"
>
  {securityTiers.map(tier => (
    <option key={tier.value} value={tier.value}>
      {tier.label}
    </option>
  ))}
</select>
```

**Validation:** Change dropdown → document tier updates

**Rollback:** Revert to static display.

---

### PHASE 4: HEADER & SEARCH

#### [TASK-13] Create Document Search Endpoint
**Status:** NOT STARTED  
**Time:** 20 min  
**Dependencies:** None  
**Risk:** LOW

**File:** `src/app/api/documents/search/route.ts` (NEW)

**Create:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    
    if (query.length < 2) {
      return NextResponse.json({ documents: [] })
    }

    const documents = await prisma.document.findMany({
      where: {
        userId: session.user.id,
        deletionStatus: 'Active',
        OR: [
          { filename: { contains: query, mode: 'insensitive' } },
          { extractedText: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        filename: true,
        indexStatus: true,
        securityTier: true,
        updatedAt: true,
        size: true,
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('[Search] Error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
```

**Validation:**
```bash
curl "https://ragbox-app.../api/documents/search?q=test" -H "Cookie: ..."
# Expected: {"documents":[...]}
```

**Rollback:** Delete file.

---

#### [TASK-14] Wire Search Bar (⌘K)
**Status:** NOT STARTED  
**Time:** 30 min  
**Dependencies:** TASK-13  
**Risk:** LOW

**File:** `src/components/dashboard/GlobalHeader.tsx`

**Add:**
```typescript
const [searchOpen, setSearchOpen] = useState(false)
const [searchQuery, setSearchQuery] = useState('')
const [searchResults, setSearchResults] = useState<Document[]>([])
const [isSearching, setIsSearching] = useState(false)
const searchRef = useRef<HTMLInputElement>(null)

// Keyboard shortcut
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setSearchOpen(true)
    }
    if (e.key === 'Escape') {
      setSearchOpen(false)
      setSearchQuery('')
      setSearchResults([])
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])

// Focus input when opened
useEffect(() => {
  if (searchOpen && searchRef.current) {
    searchRef.current.focus()
  }
}, [searchOpen])

// Debounced search
useEffect(() => {
  if (searchQuery.length < 2) {
    setSearchResults([])
    return
  }
  
  const timer = setTimeout(async () => {
    setIsSearching(true)
    try {
      const response = await fetch(`/api/documents/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setSearchResults(data.documents || [])
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }, 300)
  
  return () => clearTimeout(timer)
}, [searchQuery])

const handleSelectResult = (doc: Document) => {
  useVaultStore.getState().setSelectedItemId(doc.id)
  setSearchOpen(false)
  setSearchQuery('')
  setSearchResults([])
}

// Render search modal
{searchOpen && (
  <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-20 z-50">
    <div className="w-full max-w-2xl bg-[var(--bg-secondary)] rounded-xl shadow-2xl border border-white/10">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <Search className="w-5 h-5 text-slate-400" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search documents..."
          className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
        />
        <kbd className="px-2 py-1 text-xs bg-black/40 rounded">ESC</kbd>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {isSearching && (
          <div className="px-4 py-8 text-center text-slate-400">Searching...</div>
        )}
        {!isSearching && searchResults.length === 0 && searchQuery.length >= 2 && (
          <div className="px-4 py-8 text-center text-slate-400">No results found</div>
        )}
        {searchResults.map(doc => (
          <button
            key={doc.id}
            onClick={() => handleSelectResult(doc)}
            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 text-left"
          >
            <FileText className="w-5 h-5 text-slate-400" />
            <div>
              <div className="text-white">{doc.filename}</div>
              <div className="text-xs text-slate-500">
                {doc.indexStatus} • {new Date(doc.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  </div>
)}
```

**Validation:** Press ⌘K → modal opens → type query → results appear → click result → selects document

**Rollback:** Remove search state and modal.

---

### PHASE 5: LEFT SIDEBAR

#### [TASK-15] Wire Starred Filter
**Status:** NOT STARTED  
**Time:** 20 min  
**Dependencies:** None  
**Risk:** LOW

**First, add isStarred to schema if missing:**

**File:** `prisma/schema.prisma`
```prisma
model Document {
  // ... existing fields
  isStarred Boolean @default(false) @map("is_starred")
}
```

**Run migration:**
```bash
npx prisma migrate dev --name add_starred_field
```

**Create star endpoint:** `src/app/api/documents/[id]/star/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.document.update({
    where: { id: params.id, userId: session.user.id },
    data: { isStarred: true },
  })

  return NextResponse.json({ success: true, isStarred: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.document.update({
    where: { id: params.id, userId: session.user.id },
    data: { isStarred: false },
  })

  return NextResponse.json({ success: true, isStarred: false })
}
```

**Wire sidebar:**
```typescript
const handleQuickAccessClick = (filter: string) => {
  switch (filter) {
    case 'starred':
      fetchDocuments({ isStarred: true })
      break
    case 'recent':
      fetchDocuments({ sortBy: 'updatedAt', sortOrder: 'desc', limit: 24 })
      break
    default:
      fetchDocuments()
  }
}
```

**Validation:** Star document → click Starred in sidebar → only starred docs shown

**Rollback:** Remove migration (rollback), delete endpoint.

---

#### [TASK-16] Wire Vault Rail Collapsed Icons
**Status:** NOT STARTED  
**Time:** 15 min  
**Dependencies:** None  
**Risk:** LOW

**File:** `src/components/dashboard/vault/VaultRail.tsx`

**Find empty onClick:**
```typescript
{ icon: Cloud, label: 'Cloud Storage', onClick: () => {} },
```

**Replace with:**
```typescript
const [showStorageModal, setShowStorageModal] = useState(false)

const buttons = [
  { icon: FolderOpen, label: 'Open Vault', onClick: onExpand },
  { icon: Upload, label: 'Upload Files', onClick: onUpload },
  { icon: Cloud, label: 'Storage Usage', onClick: () => setShowStorageModal(true) },
  { icon: RefreshCw, label: 'Refresh', onClick: () => fetchDocuments() },
]
```

**Validation:** Each rail icon performs its labeled action

**Rollback:** Revert to empty handlers.

---

### PHASE 6: VALIDATION & CLEANUP

#### [TASK-17] End-to-End Validation Test
**Status:** NOT STARTED  
**Time:** 30 min  
**Dependencies:** All previous tasks  
**Risk:** N/A (Testing only)

**Test Script:**
```bash
# 1. Upload a new PDF
# 2. Wait 60 seconds
# 3. Check document status = "Indexed"
# 4. Check chunk count > 0
# 5. Check RAG toggle shows enabled
# 6. Ask Mercury: "What is in this document?"
# 7. Verify response includes citations

# Database verification:
psql $DATABASE_URL -c "
  SELECT 
    d.filename, 
    d.index_status, 
    d.chunk_count,
    COUNT(dc.id) as actual_chunks
  FROM documents d
  LEFT JOIN document_chunks dc ON dc.document_id = d.id
  WHERE d.user_id = '<USER_ID>'
  GROUP BY d.id
  ORDER BY d.updated_at DESC
  LIMIT 10;
"
```

**Expected Results:**
- index_status = 'Indexed'
- chunk_count > 0
- actual_chunks matches chunk_count
- Mercury returns cited response

---

#### [TASK-18] Run Type Check & Tests
**Status:** NOT STARTED  
**Time:** 15 min  
**Dependencies:** All previous tasks  
**Risk:** N/A

**Commands:**
```bash
cd /c/Users/d0527/RAGbox.co

# Type check
npm run type-check

# Run tests
npm test

# Build verification
npm run build
```

**Acceptance:** Zero errors, all tests pass.

---

## DEPLOYMENT CHECKLIST

```
[ ] All tasks completed
[ ] Type check passes
[ ] Tests pass
[ ] Build succeeds
[ ] Git commit with descriptive message
[ ] Push to main
[ ] Cloud Build succeeds
[ ] Production health check passes
[ ] Manual E2E test passes
```

---

## ROLLBACK PLAN

If critical issues arise post-deployment:

1. **Immediate:** Revert to previous Cloud Run revision
   ```bash
   gcloud run services update-traffic ragbox-app \
     --region=us-east4 \
     --to-revisions=ragbox-app-00018-pc6=100
   ```

2. **Code:** Git revert the merge commit
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Database:** No schema changes require rollback (isStarred is additive)

---

## SUCCESS METRICS

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Documents with Indexed status | 0% | 100% | 100% |
| Mercury query success rate | 0% | >90% | >90% |
| UI buttons with placeholders | ~15 | 0 | 0 |
| Time to first indexed doc | ∞ | <60s | <60s |

---

**END OF PRD**
