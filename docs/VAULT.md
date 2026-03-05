# Vault — Document Management & Folders

> Developer guide to the RAGbox vault: document upload, folder organization, async ingestion pipeline, and file explorer.

---

## Overview

The Vault is RAGbox's document management system. Users upload documents which are processed asynchronously through a pipeline: text extraction, semantic chunking, embedding generation, and pgvector storage. Documents can be organized into nested folders.

---

## Document Upload Flow

### Frontend (vaultStore.ts)

1. User drags files or clicks upload button
2. Frontend validates:
   - File size (max 50 MB)
   - File type (PDF, DOCX, TXT, CSV, XLSX, PPTX, PNG, JPG, GIF, WEBP, MD, JSON)
   - Non-zero size (STORY-201: 0-byte rejection)
   - Not an archive (.zip, .rar, .7z, .tar, .gz)
   - Rate limit (10 uploads per 60 seconds)
3. Duplicate filename check (STORY-200: deduplication dialog)
   - **Replace** — Delete existing, upload new
   - **Keep Both** — Append numbered suffix
   - **Skip** — Cancel upload for this file
4. `POST /api/documents/extract` with multipart form data
5. Document created with `indexStatus: 'Pending'`

### Backend (Async Pipeline)

1. Upload handler stores file in Cloud Storage (AES-256 encryption)
2. Publishes message to Pub/Sub topic `ragbox-document-worker`
3. Document worker (`server/document-worker/index.js`) processes:

| Step | Description |
|------|-------------|
| Download | Fetch file from Cloud Storage |
| Extract | Document AI text extraction (PDF, images) |
| Chunk | Semantic chunking (500 tokens max, 2-sentence overlap) |
| Embed | Vertex AI `text-embedding-004` (768 dimensions) |
| Store | pgvector storage with embeddings |
| Update | Set `indexStatus: 'Indexed'`, record chunk count |

### Status Lifecycle

```
Pending → Processing → Indexed (success)
                     → Failed (error)
```

### Error Handling

- **Retry:** Exponential backoff on Vertex AI 429/5xx (10s, 30s, 60s, 120s, 300s)
- **Max retries:** 5 attempts before permanent failure
- **Dead letter queue:** Failed events written to `roam_dead_letters` table via `writeDeadLetter()`
- **Idempotency:** Already-indexed documents are skipped on re-delivery
- **Concurrency:** Max 5 documents processed simultaneously

---

## Folder System

### Data Model

```
Folder
├── id (CUID)
├── name (string, max 255 chars)
├── userId (FK to User)
├── parentId (FK to Folder, nullable)
├── children[] (self-referential)
└── documents[] (FK from Document)
```

Folders support unlimited nesting depth via the self-referential `parentId` field.

### API Endpoints

#### `GET /api/documents/folders`

Returns all user folders as a tree structure. Orphaned folders (missing parent) are placed at root.

**Response:**
```json
{
  "success": true,
  "data": {
    "folders": [
      {
        "id": "folder-1",
        "name": "Legal",
        "parentId": null,
        "_count": { "documents": 3, "children": 1 },
        "children": [
          {
            "id": "folder-2",
            "name": "NDAs",
            "parentId": "folder-1",
            "_count": { "documents": 2, "children": 0 },
            "children": []
          }
        ]
      }
    ]
  }
}
```

#### `POST /api/documents/folders`

Create a new folder.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Folder name (max 255 chars) |
| `parentId` | string? | No | Parent folder ID for nesting |

**Validation:** Parent must belong to the same user.

#### `PATCH /api/documents/folders/[id]`

Rename a folder. Max 255 characters.

#### `DELETE /api/documents/folders/[id]`

Delete a folder. Contents are orphaned to root:
- All documents in the folder get `folderId = null`
- All child folders get `parentId = null`
- The folder record is then deleted

**Response includes:** Count of moved documents and folders.

#### `POST /api/documents/[id]/move`

Move a document to a folder or back to root.

| Field | Type | Description |
|-------|------|-------------|
| `folderId` | string? | Target folder ID, or `null` for root |

`sortOrder` resets to 0 on every move.

---

## Privilege Mode

Documents can be marked as privileged (attorney-client privilege):

- **Privileged documents** are hidden in normal mode
- Toggle privilege via `PATCH /api/documents/[id]/privilege`
- Only users with **Partner** or **Admin** role can access privilege mode
- Amber UI accent (`#f59e0b`) indicates privilege mode is active

---

## Supported File Types

| Category | Types |
|----------|-------|
| Documents | PDF, DOCX, TXT, CSV, XLSX, PPTX, MD, JSON |
| Images | PNG, JPG, GIF, WEBP |

**Rejected:** ZIP, RAR, 7Z, TAR, GZ (archive files)

**Size limit:** 50 MB per file

---

## Semantic Chunking

The document worker splits extracted text into chunks optimized for embedding:

| Parameter | Value |
|-----------|-------|
| Max chunk size | 500 tokens (~2000 chars) |
| Token estimation | ~4 characters per token |
| Overlap | 2 sentences between consecutive chunks |
| Split strategy | Paragraph boundaries, then sentence boundaries |

Overlap ensures context continuity between chunks for better retrieval.

---

## Test Coverage

| Suite | Tests | File |
|-------|-------|------|
| PubSub message handling | 3 | `src/__tests__/ingestion/asyncIngestion.test.ts` |
| Status lifecycle | 4 | same |
| Semantic chunking | 6 | same |
| Embedding generation | 7 | same |
| Health check | 2 | same |
| Folder CRUD | 13 | same |
| Document move | 5 | same |
| Tree structure | 5 | same |
| **Total** | **45** | |

---

*Last updated: March 4, 2026 — Sarah, Engineering, RAGbox.co*
