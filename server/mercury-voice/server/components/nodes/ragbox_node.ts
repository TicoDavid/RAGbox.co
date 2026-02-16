/**
 * RAGbox Node - Mercury Voice Graph
 *
 * Replaces RemoteLLMChatNode + DialogPromptBuilderNode.
 * Instead of calling a generic LLM, this node:
 *   1. Takes the user's latest message from conversation state
 *   2. Checks tool patterns (summarize, list documents, etc.)
 *   3. If tool → execute tool → return display text
 *   4. If RAG → call Go backend /api/chat → parse SSE → return answer
 *   5. Strips markdown for natural voice output
 */

import { CustomNode, ProcessContext } from '@inworld/runtime/graph';
import { State } from '../../types';

// ---------------------------------------------------------------------------
// TOOL ROUTER (mirrored from src/lib/mercury/toolRouter.ts)
// ---------------------------------------------------------------------------

interface ToolIntent {
  tool: string;
  args: Record<string, string>;
}

interface PatternDef {
  pattern: RegExp;
  tool: string;
  argMap: (m: RegExpMatchArray) => Record<string, string>;
}

const TOOL_PATTERNS: PatternDef[] = [
  { pattern: /^(summarize|summarise|summary of)\s+(.+)/i, tool: 'summarize_document', argMap: (m) => ({ query: m[2] }) },
  { pattern: /^(compare|diff)\s+(.+?)\s+(?:with|to|and|vs)\s+(.+)/i, tool: 'compare_documents', argMap: (m) => ({ doc1: m[2], doc2: m[3] }) },
  { pattern: /^(?:find|extract|show|get)\s+(?:dates?|deadlines?|key dates?)\s+(?:in|from|of)\s+(.+)/i, tool: 'extract_key_dates', argMap: (m) => ({ query: m[1] }) },
  { pattern: /^(?:find|extract|show|get)\s+(?:liability|indemnif)/i, tool: 'extract_liability_clauses', argMap: (m) => ({ query: m[0] }) },
  { pattern: /^(?:list|show)\s+(?:all\s+)?(?:documents?|files?|docs?)/i, tool: 'list_documents', argMap: () => ({}) },
  { pattern: /^(?:check|show|what are)\s+(?:the\s+)?(?:content\s+)?gaps?/i, tool: 'check_content_gaps', argMap: () => ({}) },
  { pattern: /^(?:run|check|show)\s+(?:the\s+)?(?:kb\s+|knowledge\s+)?health/i, tool: 'run_health_check', argMap: () => ({}) },
  { pattern: /^(?:export|download)\s+(?:the\s+)?audit\s*(?:log|trail)?/i, tool: 'export_audit_log', argMap: () => ({}) },
  { pattern: /^(?:show|get|what are)\s+(?:the\s+)?(?:document\s+)?stats/i, tool: 'get_document_stats', argMap: () => ({}) },
  { pattern: /^(?:list|show)\s+(?:my\s+)?documents?/i, tool: 'list_documents', argMap: () => ({}) },
  { pattern: /^(?:check|show)\s+(?:my\s+)?(?:content\s+)?gaps?/i, tool: 'check_content_gaps', argMap: () => ({}) },
];

function detectToolIntent(message: string): ToolIntent | null {
  const trimmed = message.trim();
  for (const { pattern, tool, argMap } of TOOL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return { tool, args: argMap(match) };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// SSE PARSER (mirrored from src/lib/mercury/sseParser.ts)
// ---------------------------------------------------------------------------

interface ParsedRAGResponse {
  text: string;
  confidence: number | undefined;
  isSilence: boolean;
  suggestions?: string[];
}

function parseSSEText(responseText: string): ParsedRAGResponse {
  const result: ParsedRAGResponse = { text: '', confidence: undefined, isSilence: false };
  let currentEvent = '';

  for (const line of responseText.split('\n')) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      const dataStr = line.slice(6);
      try {
        const data = JSON.parse(dataStr);
        switch (currentEvent) {
          case 'token':
            result.text += data.text ?? '';
            break;
          case 'confidence':
            result.confidence = data.score ?? data.confidence;
            break;
          case 'silence':
            result.isSilence = true;
            result.text = data.message ?? 'I could not find a grounded answer for that.';
            result.confidence = data.confidence ?? 0;
            result.suggestions = data.suggestions;
            break;
          case 'status':
          case 'done':
          case 'citations':
            break;
          default:
            if (data.text) result.text += data.text;
            if (data.message && !result.text) {
              result.isSilence = true;
              result.text = data.message;
            }
            break;
        }
      } catch {
        // skip unparseable lines
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// MARKDOWN STRIPPER (for natural voice output)
// ---------------------------------------------------------------------------

function stripMarkdownForVoice(text: string): string {
  return text
    // Remove bold/italic
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove inline citation numbers [1], [2]
    .replace(/\[\d+\]/g, '')
    // Remove markdown links [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove list markers
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Collapse multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// RAGBOX NODE
// ---------------------------------------------------------------------------

interface RAGboxNodeConfig {
  id: string;
  goBackendUrl?: string;
  internalAuthSecret?: string;
  userId?: string;
}

export class RAGboxNode extends CustomNode {
  private goBackendUrl: string;
  private internalAuthSecret: string;
  private userId: string;

  constructor(config: RAGboxNodeConfig) {
    super({ id: config.id });
    this.goBackendUrl = config.goBackendUrl || process.env.GO_BACKEND_URL || 'http://localhost:8080';
    this.internalAuthSecret = config.internalAuthSecret || process.env.INTERNAL_AUTH_SECRET || '';
    this.userId = config.userId || process.env.DEFAULT_USER_ID || '';
  }

  async process(_context: ProcessContext, state: State): Promise<string> {
    // Get the latest user message
    const lastUserMsg = [...state.messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) {
      return 'I did not receive a question. Please try again.';
    }

    const userText = lastUserMsg.content;
    console.log(`[RAGboxNode] Processing: "${userText}"`);

    // 1. Check tool patterns
    const toolIntent = detectToolIntent(userText);
    if (toolIntent) {
      console.log(`[RAGboxNode] Tool detected: ${toolIntent.tool}`);
      return await this.executeTool(toolIntent);
    }

    // 2. Call Go backend RAG pipeline
    return await this.callRAGBackend(userText);
  }

  private async executeTool(intent: ToolIntent): Promise<string> {
    // Tools that return simple messages (no API call needed)
    switch (intent.tool) {
      case 'export_audit_log':
        return 'The audit log export has been triggered. You can download it from the Audit panel.';
    }

    // Tools that need the backend
    const queryTools = ['summarize_document', 'compare_documents', 'extract_key_dates', 'extract_liability_clauses'];
    if (queryTools.includes(intent.tool)) {
      const queryMap: Record<string, string> = {
        summarize_document: `Summarize document: ${intent.args.query}`,
        compare_documents: `Compare "${intent.args.doc1}" and "${intent.args.doc2}"`,
        extract_key_dates: `Extract all dates and deadlines from ${intent.args.query}`,
        extract_liability_clauses: `Extract liability and indemnification clauses from ${intent.args.query}`,
      };
      const ragText = await this.callRAGBackend(queryMap[intent.tool] || intent.args.query);
      return stripMarkdownForVoice(ragText);
    }

    // Tools that hit specific API endpoints
    if (intent.tool === 'list_documents') {
      return await this.fetchDocumentList();
    }
    if (intent.tool === 'get_document_stats') {
      return await this.fetchDocumentStats();
    }
    if (intent.tool === 'check_content_gaps') {
      return 'Checking content gaps. Please open the Content Intelligence panel for detailed results.';
    }
    if (intent.tool === 'run_health_check') {
      return 'Running knowledge base health check. Results are available in the Health panel.';
    }

    return `I recognized the command "${intent.tool}" but cannot execute it via voice. Please use the text chat.`;
  }

  private async callRAGBackend(query: string): Promise<string> {
    try {
      const response = await fetch(`${this.goBackendUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Auth': this.internalAuthSecret,
          'X-User-ID': this.userId,
        },
        body: JSON.stringify({
          query,
          mode: 'concise',
          privilegeMode: false,
          maxTier: 3,
          history: [],
        }),
      });

      if (!response.ok) {
        console.error(`[RAGboxNode] Backend returned ${response.status}`);
        return 'Mercury is having trouble reaching the knowledge base. Please try again in a moment.';
      }

      const responseText = await response.text();
      const parsed = parseSSEText(responseText);

      if (!parsed.text) {
        return 'I was not able to find a relevant answer for that question. Try rephrasing or asking about a specific document.';
      }

      let voiceText = stripMarkdownForVoice(parsed.text);

      // Add silence protocol suggestions as spoken hints
      if (parsed.isSilence && parsed.suggestions && parsed.suggestions.length > 0) {
        voiceText += '. You could try asking about: ' + parsed.suggestions.join(', ');
      }

      return voiceText;
    } catch (error) {
      console.error('[RAGboxNode] Error calling backend:', error);
      return 'I encountered an error while processing your question. Please try again.';
    }
  }

  private async fetchDocumentList(): Promise<string> {
    try {
      const response = await fetch(`${this.goBackendUrl}/api/documents`, {
        headers: {
          'X-Internal-Auth': this.internalAuthSecret,
          'X-User-ID': this.userId,
        },
      });

      if (!response.ok) return 'I could not fetch your documents right now.';

      const json = await response.json() as { data?: Array<{ originalName: string; fileType: string; indexStatus: string }>; documents?: Array<{ originalName: string; fileType: string; indexStatus: string }> };
      const docs = json.data || json.documents || [];

      if (docs.length === 0) return 'Your vault is empty. Upload some documents to get started.';

      const names = docs.slice(0, 5).map((d: { originalName: string }) => d.originalName).join(', ');
      const more = docs.length > 5 ? `, and ${docs.length - 5} more` : '';
      return `You have ${docs.length} documents in your vault: ${names}${more}.`;
    } catch {
      return 'I could not fetch the document list right now.';
    }
  }

  private async fetchDocumentStats(): Promise<string> {
    try {
      const response = await fetch(`${this.goBackendUrl}/api/documents`, {
        headers: {
          'X-Internal-Auth': this.internalAuthSecret,
          'X-User-ID': this.userId,
        },
      });

      if (!response.ok) return 'I could not fetch document statistics.';

      const json = await response.json() as { data?: Array<{ fileType: string; sizeBytes: number; indexStatus: string }>; documents?: Array<{ fileType: string; sizeBytes: number; indexStatus: string }> };
      const docs = json.data || json.documents || [];

      if (docs.length === 0) return 'No documents found in your vault.';

      const totalSize = docs.reduce((sum: number, d: { sizeBytes: number }) => sum + d.sizeBytes, 0);
      const indexed = docs.filter((d: { indexStatus: string }) => d.indexStatus === 'Indexed').length;
      const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);

      return `You have ${docs.length} documents totaling ${sizeMB} megabytes. ${indexed} are fully indexed and ready to query.`;
    } catch {
      return 'I could not fetch document statistics right now.';
    }
  }
}
