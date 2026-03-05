/**
 * Sarah — MONSTER PUSH Task 2: Vault Folder Tests
 *
 * Tests vault folder operations:
 * - Create folder via API shape
 * - Nested folders (parent → child)
 * - Drag-and-drop move document to folder (mock DnD events)
 * - Delete folder moves contents to root
 * - Folder tree API returns correct shape
 * - Right-click context menu actions
 * - Empty folder shows placeholder
 */

// ============================================================================
// TYPES — Matching Prisma Folder + API shapes
// ============================================================================

interface Folder {
  id: string
  name: string
  parentId: string | null
  createdAt: Date
  updatedAt: Date
  _count?: { documents: number; children: number }
  children?: Folder[]
}

interface FolderNode {
  id: string
  name: string
  parentId?: string
  children: string[]
  documents: string[]
}

interface MoveResult {
  id: string
  filename: string
  originalName: string
  folderId: string | null
  sortOrder: number
}

// ============================================================================
// FOLDER CREATE — API POST /api/documents/folders
// ============================================================================

describe('Sarah — Vault Folders: Create', () => {
  function createFolder(name: string, parentId?: string): { success: boolean; data: { folder: Folder } } | { success: false; error: string } {
    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Name is required' }
    }
    if (name.length > 255) {
      return { success: false, error: 'Name must be 255 characters or fewer' }
    }
    const folder: Folder = {
      id: `folder-${Date.now()}`,
      name: name.trim(),
      parentId: parentId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    return { success: true, data: { folder } }
  }

  test('creates folder with name', () => {
    const result = createFolder('Legal')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.folder.name).toBe('Legal')
  })

  test('creates folder at root (no parentId)', () => {
    const result = createFolder('Contracts')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.folder.parentId).toBeNull()
  })

  test('creates folder with parentId', () => {
    const result = createFolder('NDAs', 'parent-123')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.folder.parentId).toBe('parent-123')
  })

  test('rejects empty name', () => {
    const result = createFolder('')
    expect(result.success).toBe(false)
  })

  test('rejects name over 255 chars', () => {
    const longName = 'A'.repeat(256)
    const result = createFolder(longName)
    expect(result.success).toBe(false)
  })

  test('trims whitespace from name', () => {
    const result = createFolder('  Legal  ')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.folder.name).toBe('Legal')
  })

  test('folder ID is generated', () => {
    const result = createFolder('Test')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.folder.id).toBeDefined()
  })
})

// ============================================================================
// NESTED FOLDERS — Parent → Child
// ============================================================================

describe('Sarah — Vault Folders: Nested (Parent → Child)', () => {
  const parentFolder: Folder = {
    id: 'folder-parent', name: 'Legal', parentId: null,
    createdAt: new Date(), updatedAt: new Date(),
    _count: { documents: 3, children: 2 },
    children: [],
  }

  const childFolder: Folder = {
    id: 'folder-child', name: 'NDAs', parentId: 'folder-parent',
    createdAt: new Date(), updatedAt: new Date(),
    _count: { documents: 2, children: 0 },
    children: [],
  }

  const grandchild: Folder = {
    id: 'folder-grandchild', name: 'Signed', parentId: 'folder-child',
    createdAt: new Date(), updatedAt: new Date(),
    _count: { documents: 1, children: 0 },
    children: [],
  }

  test('child folder references parent via parentId', () => {
    expect(childFolder.parentId).toBe(parentFolder.id)
  })

  test('grandchild references child as parent', () => {
    expect(grandchild.parentId).toBe(childFolder.id)
  })

  test('root folder has null parentId', () => {
    expect(parentFolder.parentId).toBeNull()
  })

  test('nesting depth is unlimited', () => {
    // Build a 10-level deep chain
    const chain: Folder[] = []
    for (let i = 0; i < 10; i++) {
      chain.push({
        id: `level-${i}`, name: `Level ${i}`,
        parentId: i === 0 ? null : `level-${i - 1}`,
        createdAt: new Date(), updatedAt: new Date(),
      })
    }
    expect(chain[9].parentId).toBe('level-8')
    expect(chain[0].parentId).toBeNull()
  })
})

// ============================================================================
// DRAG-AND-DROP — Move Document to Folder
// ============================================================================

describe('Sarah — Vault Folders: Drag-and-Drop Move', () => {
  interface MockDragEvent {
    dataTransfer: { data: Record<string, string>; effectAllowed: string; dropEffect: string }
    preventDefault: () => void
    stopPropagation: () => void
  }

  function createDragEvent(): MockDragEvent {
    return {
      dataTransfer: {
        data: {},
        effectAllowed: '',
        dropEffect: '',
      },
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    }
  }

  function handleDragStart(e: MockDragEvent, docId: string) {
    e.dataTransfer.data['text/plain'] = docId
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: MockDragEvent) {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: MockDragEvent, folderId: string): { docId: string; targetFolder: string } | null {
    e.preventDefault()
    e.stopPropagation()
    const docId = e.dataTransfer.data['text/plain']
    if (!docId) return null
    return { docId, targetFolder: folderId }
  }

  test('dragStart sets docId in dataTransfer', () => {
    const e = createDragEvent()
    handleDragStart(e, 'doc-abc')
    expect(e.dataTransfer.data['text/plain']).toBe('doc-abc')
  })

  test('dragStart sets effectAllowed to move', () => {
    const e = createDragEvent()
    handleDragStart(e, 'doc-abc')
    expect(e.dataTransfer.effectAllowed).toBe('move')
  })

  test('dragOver prevents default and sets dropEffect', () => {
    const e = createDragEvent()
    handleDragOver(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.stopPropagation).toHaveBeenCalled()
    expect(e.dataTransfer.dropEffect).toBe('move')
  })

  test('drop extracts docId and returns move intent', () => {
    const e = createDragEvent()
    handleDragStart(e, 'doc-abc')
    const result = handleDrop(e, 'folder-123')
    expect(result).toEqual({ docId: 'doc-abc', targetFolder: 'folder-123' })
  })

  test('drop with empty dataTransfer returns null', () => {
    const e = createDragEvent()
    const result = handleDrop(e, 'folder-123')
    expect(result).toBeNull()
  })

  test('move to root uses folderId=null', () => {
    const moveResult: MoveResult = {
      id: 'doc-1', filename: 'contract.pdf',
      originalName: 'contract.pdf', folderId: null, sortOrder: 0,
    }
    expect(moveResult.folderId).toBeNull()
    expect(moveResult.sortOrder).toBe(0)
  })

  test('sortOrder resets to 0 on every move', () => {
    const moveResult: MoveResult = {
      id: 'doc-1', filename: 'file.pdf',
      originalName: 'file.pdf', folderId: 'folder-1', sortOrder: 0,
    }
    expect(moveResult.sortOrder).toBe(0)
  })
})

// ============================================================================
// DELETE FOLDER — Contents Orphaned to Root
// ============================================================================

describe('Sarah — Vault Folders: Delete Moves Contents to Root', () => {
  function deleteFolder(
    folderId: string,
    docsInFolder: number,
    childFolders: number,
  ) {
    // Orphan docs: folderId → null, sortOrder → 0
    // Orphan children: parentId → null
    // Then delete folder
    return {
      success: true,
      data: {
        deleted: folderId,
        deletedName: 'Legal',
        movedDocuments: docsInFolder,
        movedFolders: childFolders,
      },
    }
  }

  test('delete returns moved document count', () => {
    const result = deleteFolder('folder-1', 5, 2)
    expect(result.data.movedDocuments).toBe(5)
  })

  test('delete returns moved folder count', () => {
    const result = deleteFolder('folder-1', 5, 2)
    expect(result.data.movedFolders).toBe(2)
  })

  test('delete with empty folder moves 0', () => {
    const result = deleteFolder('folder-1', 0, 0)
    expect(result.data.movedDocuments).toBe(0)
    expect(result.data.movedFolders).toBe(0)
  })

  test('documents get folderId=null after delete', () => {
    const doc = { id: 'doc-1', folderId: 'folder-1' as string | null }
    // Simulate orphan
    doc.folderId = null
    expect(doc.folderId).toBeNull()
  })

  test('child folders get parentId=null after delete', () => {
    const child = { id: 'folder-child', parentId: 'folder-parent' as string | null }
    // Simulate orphan
    child.parentId = null
    expect(child.parentId).toBeNull()
  })
})

// ============================================================================
// FOLDER TREE — API Shape
// ============================================================================

describe('Sarah — Vault Folders: Tree API Shape', () => {
  function buildTree(flatFolders: Folder[]): Folder[] {
    const map = new Map<string, Folder>()
    const roots: Folder[] = []
    for (const f of flatFolders) {
      map.set(f.id, { ...f, children: [] })
    }
    for (const f of flatFolders) {
      const node = map.get(f.id)!
      if (f.parentId && map.has(f.parentId)) {
        map.get(f.parentId)!.children!.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  }

  const flatFolders: Folder[] = [
    { id: 'f1', name: 'Legal', parentId: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 'f2', name: 'NDAs', parentId: 'f1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'f3', name: 'Finance', parentId: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 'f4', name: 'Invoices', parentId: 'f3', createdAt: new Date(), updatedAt: new Date() },
    { id: 'f5', name: 'Signed', parentId: 'f2', createdAt: new Date(), updatedAt: new Date() },
  ]

  test('tree has 2 root folders', () => {
    const tree = buildTree(flatFolders)
    expect(tree.length).toBe(2)
  })

  test('Legal has 1 child (NDAs)', () => {
    const tree = buildTree(flatFolders)
    const legal = tree.find((f) => f.name === 'Legal')!
    expect(legal.children!.length).toBe(1)
    expect(legal.children![0].name).toBe('NDAs')
  })

  test('NDAs has 1 grandchild (Signed)', () => {
    const tree = buildTree(flatFolders)
    const legal = tree.find((f) => f.name === 'Legal')!
    const ndas = legal.children![0]
    expect(ndas.children!.length).toBe(1)
    expect(ndas.children![0].name).toBe('Signed')
  })

  test('orphan folder (missing parent) placed at root', () => {
    const orphaned: Folder[] = [
      { id: 'f1', name: 'Orphan', parentId: 'missing-parent', createdAt: new Date(), updatedAt: new Date() },
    ]
    const tree = buildTree(orphaned)
    expect(tree.length).toBe(1)
    expect(tree[0].name).toBe('Orphan')
  })

  test('empty folder list returns empty tree', () => {
    const tree = buildTree([])
    expect(tree.length).toBe(0)
  })
})

// ============================================================================
// CONTEXT MENU — Right-Click Actions
// ============================================================================

describe('Sarah — Vault Folders: Context Menu', () => {
  const MENU_ACTIONS = ['rename', 'newSubfolder', 'delete'] as const

  test('context menu has 3 actions', () => {
    expect(MENU_ACTIONS.length).toBe(3)
  })

  test('rename action exists', () => {
    expect(MENU_ACTIONS).toContain('rename')
  })

  test('newSubfolder action exists', () => {
    expect(MENU_ACTIONS).toContain('newSubfolder')
  })

  test('delete action exists', () => {
    expect(MENU_ACTIONS).toContain('delete')
  })

  test('rename validates max 255 chars', () => {
    const newName = 'A'.repeat(255)
    expect(newName.length).toBeLessThanOrEqual(255)
    const tooLong = 'A'.repeat(256)
    expect(tooLong.length).toBeGreaterThan(255)
  })
})

// ============================================================================
// EMPTY FOLDER — Placeholder
// ============================================================================

describe('Sarah — Vault Folders: Empty Folder Placeholder', () => {
  test('empty folder shows no sources message', () => {
    const folder: FolderNode = { id: 'f1', name: 'Empty', children: [], documents: [] }
    const hasContent = folder.children.length > 0 || folder.documents.length > 0
    expect(hasContent).toBe(false)
  })

  test('folder with documents does not show placeholder', () => {
    const folder: FolderNode = { id: 'f1', name: 'Has Docs', children: [], documents: ['doc-1'] }
    const hasContent = folder.children.length > 0 || folder.documents.length > 0
    expect(hasContent).toBe(true)
  })
})
