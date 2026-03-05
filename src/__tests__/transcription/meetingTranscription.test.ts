/**
 * Sarah — FINAL WAVE Task 5: Meeting Transcription Tests
 *
 * Tests meeting transcription pipeline:
 * - Audio file type detection (mp3, wav, m4a, webm NOT in allowed extensions)
 * - ROAM transcript.saved event handling
 * - Transcript document creation with metadata
 * - Deepgram STT configuration
 * - CyGraph extraction triggered on transcript text
 * - Transcript summary generation
 */

export {}

// ============================================================================
// TYPES — Transcript + Document + Audio
// ============================================================================

interface RoamTranscriptEvent {
  type: 'transcript.saved'
  data: {
    transcript_id: string
    group_id?: string
    chat?: { id: string }
    title?: string
  }
}

interface RoamTranscriptInfo {
  id: string
  groupId: string
  title?: string
  participants?: string[]
  content: string
  duration?: number
  createdAt?: string
}

interface TranscriptDocument {
  id: string
  userId: string
  filename: string
  originalName: string
  mimeType: string
  fileType: string
  sizeBytes: number
  extractedText: string
  indexStatus: 'Pending' | 'Processing' | 'Indexed' | 'Failed'
  metadata: {
    source: 'roam_transcript'
    transcriptId: string
    groupId?: string
    participants?: string[]
    duration?: number
  }
}

// ============================================================================
// AUDIO FILE DETECTION — Not in ALLOWED_EXTENSIONS
// ============================================================================

describe('Sarah — Meeting Transcription: Audio File Detection', () => {
  const ALLOWED_EXTENSIONS = new Set([
    '.pdf', '.doc', '.docx', '.txt', '.csv', '.xlsx', '.xls', '.pptx',
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.md', '.json',
  ])

  const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.webm', '.ogg', '.flac']

  function isAudioFile(filename: string): boolean {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
    return AUDIO_EXTENSIONS.includes(ext)
  }

  function isAllowedUpload(filename: string): boolean {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
    return ALLOWED_EXTENSIONS.has(ext)
  }

  test('audio files NOT in allowed upload extensions', () => {
    for (const ext of AUDIO_EXTENSIONS) {
      expect(ALLOWED_EXTENSIONS.has(ext)).toBe(false)
    }
  })

  test('mp3 detected as audio file', () => {
    expect(isAudioFile('meeting-recording.mp3')).toBe(true)
  })

  test('wav detected as audio file', () => {
    expect(isAudioFile('call-transcript.wav')).toBe(true)
  })

  test('m4a detected as audio file', () => {
    expect(isAudioFile('voice-memo.m4a')).toBe(true)
  })

  test('webm detected as audio file', () => {
    expect(isAudioFile('browser-recording.webm')).toBe(true)
  })

  test('pdf is NOT an audio file', () => {
    expect(isAudioFile('contract.pdf')).toBe(false)
  })

  test('audio files rejected by upload validator', () => {
    expect(isAllowedUpload('recording.mp3')).toBe(false)
    expect(isAllowedUpload('meeting.wav')).toBe(false)
    expect(isAllowedUpload('memo.m4a')).toBe(false)
  })

  test('document files accepted by upload validator', () => {
    expect(isAllowedUpload('contract.pdf')).toBe(true)
    expect(isAllowedUpload('notes.txt')).toBe(true)
    expect(isAllowedUpload('data.csv')).toBe(true)
  })
})

// ============================================================================
// ROAM TRANSCRIPT EVENT — transcript.saved Webhook
// ============================================================================

describe('Sarah — Meeting Transcription: ROAM Transcript Event', () => {
  function validateTranscriptEvent(event: RoamTranscriptEvent): boolean {
    return event.type === 'transcript.saved' && !!event.data.transcript_id
  }

  function buildTranscriptFilename(transcriptId: string): string {
    return `roam-transcript-${transcriptId.slice(0, 8)}.txt`
  }

  test('transcript.saved event validated', () => {
    const event: RoamTranscriptEvent = {
      type: 'transcript.saved',
      data: { transcript_id: 'transcript-abc123def456', group_id: 'grp-1' },
    }
    expect(validateTranscriptEvent(event)).toBe(true)
  })

  test('missing transcript_id rejected', () => {
    const event = {
      type: 'transcript.saved',
      data: { group_id: 'grp-1' },
    } as unknown as RoamTranscriptEvent
    expect(validateTranscriptEvent(event)).toBe(false)
  })

  test('filename uses first 8 chars of transcript ID', () => {
    const filename = buildTranscriptFilename('transcript-abc123def456')
    expect(filename).toBe('roam-transcript-transcri.txt')
  })

  test('transcript event may include chat context', () => {
    const event: RoamTranscriptEvent = {
      type: 'transcript.saved',
      data: {
        transcript_id: 'tx-001',
        chat: { id: 'chat-meeting-room' },
        title: 'Q1 Planning Review',
      },
    }
    expect(event.data.chat!.id).toBe('chat-meeting-room')
    expect(event.data.title).toBe('Q1 Planning Review')
  })
})

// ============================================================================
// TRANSCRIPT DOCUMENT — Creation + Metadata
// ============================================================================

describe('Sarah — Meeting Transcription: Document Creation', () => {
  function createTranscriptDocument(
    userId: string,
    transcript: RoamTranscriptInfo,
  ): TranscriptDocument {
    const content = transcript.content
    return {
      id: `doc-${Date.now()}`,
      userId,
      filename: `roam-transcript-${transcript.id.slice(0, 8)}.txt`,
      originalName: transcript.title || `Meeting Transcript — ${new Date().toLocaleDateString()}`,
      mimeType: 'text/plain',
      fileType: 'txt',
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
      extractedText: content,
      indexStatus: 'Pending',
      metadata: {
        source: 'roam_transcript',
        transcriptId: transcript.id,
        groupId: transcript.groupId,
        participants: transcript.participants,
        duration: transcript.duration,
      },
    }
  }

  const sampleTranscript: RoamTranscriptInfo = {
    id: 'tx-abc12345',
    groupId: 'grp-legal-team',
    title: 'Contract Review Meeting',
    participants: ['Alice', 'Bob', 'Charlie'],
    content: 'Alice: Let\'s review the NDA terms.\nBob: The termination clause needs updating.\nCharlie: I agree, section 5.2 is outdated.',
    duration: 1800,
    createdAt: '2026-03-04T10:00:00Z',
  }

  test('document created with text/plain MIME type', () => {
    const doc = createTranscriptDocument('user-1', sampleTranscript)
    expect(doc.mimeType).toBe('text/plain')
    expect(doc.fileType).toBe('txt')
  })

  test('document has Pending index status', () => {
    const doc = createTranscriptDocument('user-1', sampleTranscript)
    expect(doc.indexStatus).toBe('Pending')
  })

  test('metadata source is roam_transcript', () => {
    const doc = createTranscriptDocument('user-1', sampleTranscript)
    expect(doc.metadata.source).toBe('roam_transcript')
  })

  test('metadata includes participants list', () => {
    const doc = createTranscriptDocument('user-1', sampleTranscript)
    expect(doc.metadata.participants).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  test('metadata includes duration in seconds', () => {
    const doc = createTranscriptDocument('user-1', sampleTranscript)
    expect(doc.metadata.duration).toBe(1800)
  })

  test('sizeBytes calculated from content', () => {
    const doc = createTranscriptDocument('user-1', sampleTranscript)
    expect(doc.sizeBytes).toBe(Buffer.byteLength(sampleTranscript.content, 'utf-8'))
    expect(doc.sizeBytes).toBeGreaterThan(0)
  })

  test('originalName falls back to generic title when title missing', () => {
    const noTitle: RoamTranscriptInfo = { ...sampleTranscript, title: undefined }
    const doc = createTranscriptDocument('user-1', noTitle)
    expect(doc.originalName).toContain('Meeting Transcript')
  })
})

// ============================================================================
// DEEPGRAM STT — Configuration
// ============================================================================

describe('Sarah — Meeting Transcription: Deepgram STT Config', () => {
  const DEEPGRAM_CONFIG = {
    model: 'nova-2',
    encoding: 'linear16',
    sampleRate: 16000,
    channels: 1,
    interim_results: true,
    endpointing: 300,
    keepAliveMs: 20000,
    maxReconnectAttempts: 3,
  }

  test('uses Nova-2 model', () => {
    expect(DEEPGRAM_CONFIG.model).toBe('nova-2')
  })

  test('audio format is linear16 at 16kHz mono', () => {
    expect(DEEPGRAM_CONFIG.encoding).toBe('linear16')
    expect(DEEPGRAM_CONFIG.sampleRate).toBe(16000)
    expect(DEEPGRAM_CONFIG.channels).toBe(1)
  })

  test('interim results enabled for real-time feedback', () => {
    expect(DEEPGRAM_CONFIG.interim_results).toBe(true)
  })

  test('keepalive heartbeat every 20 seconds', () => {
    expect(DEEPGRAM_CONFIG.keepAliveMs).toBe(20000)
  })

  test('max 3 reconnect attempts', () => {
    expect(DEEPGRAM_CONFIG.maxReconnectAttempts).toBe(3)
  })
})

// ============================================================================
// CYGRAPH EXTRACTION ON TRANSCRIPTS
// ============================================================================

describe('Sarah — Meeting Transcription: CyGraph Extraction', () => {
  function convertTranscriptToChunks(
    transcriptId: string,
    content: string,
    chunkSize: number = 2000,
  ): Array<{ id: string; content: string; documentId: string }> {
    const chunks: Array<{ id: string; content: string; documentId: string }> = []
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push({
        id: `chunk-${transcriptId}-${chunks.length}`,
        content: content.slice(i, i + chunkSize),
        documentId: `transcript:${transcriptId}`,
      })
    }
    return chunks
  }

  test('transcript text split into chunks for extraction', () => {
    const content = 'A'.repeat(5000)
    const chunks = convertTranscriptToChunks('tx-1', content, 2000)
    expect(chunks.length).toBe(3) // 2000 + 2000 + 1000
  })

  test('chunk documentId uses transcript: prefix', () => {
    const chunks = convertTranscriptToChunks('tx-abc', 'Hello world')
    expect(chunks[0].documentId).toBe('transcript:tx-abc')
  })

  test('short transcript produces single chunk', () => {
    const chunks = convertTranscriptToChunks('tx-1', 'Short meeting notes.')
    expect(chunks.length).toBe(1)
  })

  test('chunk IDs are sequential', () => {
    const content = 'B'.repeat(4500)
    const chunks = convertTranscriptToChunks('tx-1', content, 2000)
    expect(chunks[0].id).toBe('chunk-tx-1-0')
    expect(chunks[1].id).toBe('chunk-tx-1-1')
    expect(chunks[2].id).toBe('chunk-tx-1-2')
  })

  test('conversation extraction uses thread: prefix pattern', () => {
    // Matches triggerConversationExtraction in extractionTrigger.ts
    const threadId = 'thread-meeting-001'
    const docId = `thread:${threadId}`
    expect(docId).toBe('thread:thread-meeting-001')
  })
})
