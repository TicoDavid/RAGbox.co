# PRD: RAGbox.co UI Wiring (Corrected)
## Version 2.0 | February 12, 2026

---

## Architecture Reality Check

**This PRD replaces the incorrect v1.0 that assumed Prisma/monolithic architecture.**

### Actual Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS FRONTEND                            │
│  - UI Components (React/Zustand)                                │
│  - Thin API proxies → Go backend                                │
│  - Auth routes (NextAuth, Firebase OTP)                         │
│  - Voice/TTS routes (direct)                                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │ apiFetch() / proxyToBackend()
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GO BACKEND                                  │
│  - ALL document CRUD (pgx → PostgreSQL)                         │
│  - ALL RAG pipeline (ingest, embed, retrieve)                   │
│  - ALL chat (SSE streaming)                                     │
│  - ALL audit logging                                            │
│  - Privilege & tier management                                  │
└─────────────────────────────────────────────────────────────────┘
```

### What's Already Working ✅
- Upload → GCS (signed URL flow)
- Document AI / DOCX parsing
- Semantic chunking
- Vertex AI embeddings (text-embedding-004, RETRIEVAL_DOCUMENT)
- pgvector storage
- RAG retrieval (RETRIEVAL_QUERY, cosine similarity, threshold 0.35)
- Self-RAG reflection loop
- SSE streaming to frontend
- Frontend SSE parser (fixed in bdfbac6)
- 8 documents indexed, 21 chunks, 0.81 confidence responses

### What Needs Wiring 🔧
UI elements with placeholder handlers that need to call existing Go endpoints.

---

## TASK QUEUE (Corrected)

### PHASE 1: CRITICAL UI GAPS

#### [TASK-01] Wire Security Tier Dropdown
**Status:** NOT STARTED  
**Time:** 15 min  
**File:** `src/components/dashboard/vault/SovereignExplorer.tsx`

**Problem:** Dropdown changes local state only, never persists.

**Existing Go Endpoint:** `PATCH /api/documents/{id}/tier`
```json
// Request body
{ "securityTier": 0 | 1 | 2 }
// 0 = General, 1 = Confidential, 2 = Privileged
```

**Fix:**
```typescript
const handleSecurityChange = async (docId: string, tier: number) => {
  try {
    await apiFetch(`/api/documents/${docId}/tier`, {
      method: 'PATCH',
      body: JSON.stringify({ securityTier: tier }),
    })
    // Refresh document list
    await fetchDocuments()
  } catch (error) {
    console.error('Failed to update security tier:', error)
  }
}
```

**Validation:** Change dropdown → refresh page → value persists

---

#### [TASK-02] Wire RAG Index Toggle (Enable)
**Status:** NOT STARTED  
**Time:** 15 min  
**File:** `src/components/dashboard/vault/SovereignExplorer.tsx`

**Problem:** Toggle is local state only.

**Existing Go Endpoint:** `POST /api/documents/{id}/ingest`

**Fix:**
```typescript
const handleEnableRAG = async (docId: string) => {
  setIsIndexing(true)
  try {
    await apiFetch(`/api/documents/${docId}/ingest`, {
      method: 'POST',
    })
    await fetchDocuments()
  } catch (error) {
    console.error('Failed to index document:', error)
  } finally {
    setIsIndexing(false)
  }
}
```

**Validation:** Toggle ON → document status changes to "Indexed" → chunks appear in DB

---

#### [TASK-03] Create RAG Disable Endpoint (Go Backend)
**Status:** NOT STARTED  
**Time:** 30 min  
**File:** `backend/internal/handler/documents.go`

**Problem:** No endpoint to remove embeddings (disable RAG).

**Create:** `DELETE /api/documents/{id}/chunks`

```go
// In documents.go, add:
func (h *DocumentHandler) DeleteChunks(w http.ResponseWriter, r *http.Request) {
    docID := chi.URLParam(r, "id")
    userID := r.Context().Value("userID").(string)
    
    // Verify ownership
    doc, err := h.docService.GetByID(r.Context(), docID)
    if err != nil || doc.UserID != userID {
        http.Error(w, "Not found", http.StatusNotFound)
        return
    }
    
    // Delete chunks
    _, err = h.db.Exec(r.Context(), 
        "DELETE FROM document_chunks WHERE document_id = $1", docID)
    if err != nil {
        http.Error(w, "Failed to delete chunks", http.StatusInternalServerError)
        return
    }
    
    // Update document status
    _, err = h.db.Exec(r.Context(),
        "UPDATE documents SET index_status = 'Pending', chunk_count = 0 WHERE id = $1", docID)
    if err != nil {
        http.Error(w, "Failed to update document", http.StatusInternalServerError)
        return
    }
    
    // Audit log
    h.auditService.Log(r.Context(), userID, "EMBEDDINGS_DELETED", "document", docID, nil)
    
    json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// In router, add:
r.Delete("/api/documents/{id}/chunks", h.DeleteChunks)
```

**Validation:** Call endpoint → chunks deleted → document status = "Pending"

---

#### [TASK-04] Wire RAG Index Toggle (Disable)
**Status:** NOT STARTED  
**Time:** 10 min  
**Dependencies:** TASK-03  
**File:** `src/components/dashboard/vault/SovereignExplorer.tsx`

**Fix:**
```typescript
const handleDisableRAG = async (docId: string) => {
  try {
    await apiFetch(`/api/documents/${docId}/chunks`, {
      method: 'DELETE',
    })
    await fetchDocuments()
  } catch (error) {
    console.error('Failed to disable RAG:', error)
  }
}

// Combined toggle handler:
const handleRAGToggle = async (docId: string, enable: boolean) => {
  if (enable) {
    await handleEnableRAG(docId)
  } else {
    await handleDisableRAG(docId)
  }
}
```

---

### PHASE 2: TOOLBAR BUTTONS

#### [TASK-05] Wire Vectorize Toolbar Button
**Status:** NOT STARTED  
**Time:** 20 min  
**File:** `src/components/dashboard/vault/VaultPanel.tsx` or toolbar component

**Find:** The "Vectorize" button in toolbar

**Fix:**
```typescript
const [isVectorizing, setIsVectorizing] = useState(false)

const handleVectorize = async () => {
  setIsVectorizing(true)
  try {
    // Get documents with Pending status
    const pendingDocs = documents.filter(d => d.indexStatus === 'Pending')
    
    for (const doc of pendingDocs) {
      await apiFetch(`/api/documents/${doc.id}/ingest`, { method: 'POST' })
    }
    
    await fetchDocuments()
  } catch (error) {
    console.error('Batch vectorization failed:', error)
  } finally {
    setIsVectorizing(false)
  }
}
```

**Validation:** Click Vectorize → all Pending docs become Indexed

---

#### [TASK-06] Add Multi-Select to vaultStore
**Status:** NOT STARTED  
**Time:** 20 min  
**File:** `src/stores/vaultStore.ts`

**Problem:** Store only has `selectedItemId` (single selection).

**Add:**
```typescript
interface VaultState {
  // ... existing
  selectedDocumentIds: string[]
  setSelectedDocumentIds: (ids: string[]) => void
  toggleDocumentSelection: (id: string) => void
  clearSelection: () => void
  selectAll: () => void
}

// Implementation:
selectedDocumentIds: [],

setSelectedDocumentIds: (ids) => set({ selectedDocumentIds: ids }),

toggleDocumentSelection: (id) => set((state) => ({
  selectedDocumentIds: state.selectedDocumentIds.includes(id)
    ? state.selectedDocumentIds.filter(i => i !== id)
    : [...state.selectedDocumentIds, id]
})),

clearSelection: () => set({ selectedDocumentIds: [] }),

selectAll: () => set((state) => ({
  selectedDocumentIds: state.documents.map(d => d.id)
})),
```

**Validation:** Shift+click selects multiple → state reflects selection

---

#### [TASK-07] Wire Move To Button
**Status:** NOT STARTED  
**Time:** 25 min  
**Dependencies:** TASK-06  
**File:** `src/components/dashboard/vault/VaultPanel.tsx`

**Existing Go Endpoint:** `PATCH /api/documents/{id}` accepts `folderId`

**Fix:**
```typescript
const handleMoveTo = async (targetFolderId: string | null) => {
  const selectedIds = useVaultStore.getState().selectedDocumentIds
  
  for (const docId of selectedIds) {
    await apiFetch(`/api/documents/${docId}`, {
      method: 'PATCH',
      body: JSON.stringify({ folderId: targetFolderId }),
    })
  }
  
  useVaultStore.getState().clearSelection()
  await fetchDocuments()
}
```

---

#### [TASK-08] Wire Security Bulk Button
**Status:** NOT STARTED  
**Time:** 20 min  
**Dependencies:** TASK-06  
**File:** `src/components/dashboard/vault/VaultPanel.tsx`

**Fix:**
```typescript
const handleBulkSecurity = async (tier: number) => {
  const selectedIds = useVaultStore.getState().selectedDocumentIds
  
  for (const docId of selectedIds) {
    await apiFetch(`/api/documents/${docId}/tier`, {
      method: 'PATCH',
      body: JSON.stringify({ securityTier: tier }),
    })
  }
  
  await fetchDocuments()
}
```

---

### PHASE 3: DOCUMENT INSPECTOR

#### [TASK-09] Wire Download Button
**Status:** NOT STARTED  
**Time:** 20 min  
**File:** `src/components/dashboard/vault/SovereignExplorer.tsx`

**Problem:** Button exists but no handler.

**Approach:** Get signed download URL from Go backend.

**Need to check:** Does Go backend have a download URL endpoint? If not, create one.

**Fix (frontend):**
```typescript
const handleDownload = async (doc: Document) => {
  try {
    // Option A: If backend returns signed URL
    const response = await apiFetch(`/api/documents/${doc.id}/download`)
    const { url } = await response.json()
    window.open(url, '_blank')
    
    // Option B: If using storage_uri directly (less secure)
    // window.open(doc.storageUri, '_blank')
  } catch (error) {
    console.error('Download failed:', error)
  }
}
```

---

#### [TASK-10] Wire Audit Log Button
**Status:** NOT STARTED  
**Time:** 15 min  
**File:** `src/components/dashboard/vault/SovereignExplorer.tsx`

**Existing Go Endpoint:** `GET /api/audit?documentId={id}`

**Fix:**
```typescript
const [showAuditModal, setShowAuditModal] = useState(false)
const [auditLogs, setAuditLogs] = useState([])

const handleShowAuditLog = async (docId: string) => {
  const response = await apiFetch(`/api/audit?documentId=${docId}`)
  const data = await response.json()
  setAuditLogs(data.logs || [])
  setShowAuditModal(true)
}
```

---

#### [TASK-11] Wire Verify Integrity Button
**Status:** NOT STARTED  
**Time:** 30 min  

**Problem:** Need endpoint to verify document hash.

**Create Go Endpoint:** `POST /api/documents/{id}/verify`

```go
func (h *DocumentHandler) VerifyIntegrity(w http.ResponseWriter, r *http.Request) {
    docID := chi.URLParam(r, "id")
    
    doc, err := h.docService.GetByID(r.Context(), docID)
    if err != nil {
        http.Error(w, "Not found", http.StatusNotFound)
        return
    }
    
    // Download from GCS and compute hash
    data, err := h.storage.Download(r.Context(), doc.StoragePath)
    if err != nil {
        json.NewEncoder(w).Encode(map[string]interface{}{
            "valid": false,
            "error": "Could not download file",
        })
        return
    }
    
    hash := sha256.Sum256(data)
    computedHash := hex.EncodeToString(hash[:])
    
    json.NewEncoder(w).Encode(map[string]interface{}{
        "valid":        computedHash == doc.Checksum,
        "storedHash":   doc.Checksum,
        "computedHash": computedHash,
    })
}
```

---

### PHASE 4: SIDEBAR & HEADER

#### [TASK-12] Wire Cloud Storage Rail Icon
**Status:** NOT STARTED  
**Time:** 10 min  
**File:** `src/components/dashboard/vault/VaultRail.tsx`

**Find:** `onClick: () => {}`

**Fix:**
```typescript
{ 
  icon: Cloud, 
  label: 'Storage Usage', 
  onClick: () => {
    // Show storage modal or navigate to storage view
    setShowStorageModal(true)
  }
},
```

---

#### [TASK-13] Wire Search Bar (⌘K)
**Status:** NOT STARTED  
**Time:** 30 min  
**File:** `src/components/dashboard/GlobalHeader.tsx`

**Existing Go Endpoint:** Check if search exists, otherwise filter client-side.

**Fix:** Implement command palette with document search.

---

#### [TASK-14] Add Starred Functionality
**Status:** NOT STARTED  
**Time:** 25 min  

**Problem:** No `isStarred` field or endpoint.

**Create Go Endpoint:** `POST/DELETE /api/documents/{id}/star`

**Add to schema:**
```sql
ALTER TABLE documents ADD COLUMN is_starred BOOLEAN DEFAULT false;
```

---

### PHASE 5: VALIDATION

#### [TASK-15] End-to-End Test
**Status:** NOT STARTED  
**Time:** 30 min  

**Test Script:**
1. Upload new document → verify "Indexed" status
2. Ask Mercury question about document → verify cited response
3. Change security tier → verify persists
4. Toggle RAG off → verify chunks deleted
5. Toggle RAG on → verify re-indexed
6. Click Download → verify file downloads
7. Click Audit Log → verify logs appear

---

## Summary of Changes

### Go Backend (New Endpoints)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/documents/{id}/chunks` | DELETE | Remove embeddings (disable RAG) |
| `/api/documents/{id}/verify` | POST | Hash integrity check |
| `/api/documents/{id}/star` | POST/DELETE | Star/unstar |
| `/api/documents/{id}/download` | GET | Signed download URL |

### Frontend (Wire to Existing)
| Component | Action | Go Endpoint |
|-----------|--------|-------------|
| Security dropdown | Change tier | PATCH `/api/documents/{id}/tier` |
| RAG toggle (on) | Index | POST `/api/documents/{id}/ingest` |
| RAG toggle (off) | Delete chunks | DELETE `/api/documents/{id}/chunks` |
| Vectorize button | Batch ingest | POST `/api/documents/{id}/ingest` (loop) |
| Move To | Change folder | PATCH `/api/documents/{id}` |
| Download | Get file | GET `/api/documents/{id}/download` |
| Audit Log | View logs | GET `/api/audit?documentId={id}` |

### vaultStore Additions
- `selectedDocumentIds: string[]`
- `toggleDocumentSelection(id)`
- `clearSelection()`
- `selectAll()`

---

## Execution Order

1. TASK-01: Security dropdown (quick win, no backend changes)
2. TASK-02: RAG enable (uses existing endpoint)
3. TASK-03: Create chunks DELETE endpoint
4. TASK-04: RAG disable
5. TASK-06: Multi-select store
6. TASK-05, 07, 08: Toolbar buttons
7. TASK-09-11: Inspector buttons
8. TASK-12-14: Sidebar/header
9. TASK-15: E2E validation

---

**END OF CORRECTED PRD**
