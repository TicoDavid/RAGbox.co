# Inworld API & Runtime Reference — RAGbox.co

**Compiled by:** Zane (PM) from David Pierce (CPO) provided documentation
**Date:** 2026-03-08
**Purpose:** Reference for Mercury Voice (BUG fixes) and EPIC-029 VERITAS CAST

---

## 1. Voice API

### List Voices
```
GET https://api.inworld.ai/voices/v1/voices
Header: x-api-key: <INWORLD_API_KEY>
```
Returns: `[{ voiceId, displayName, langCode, source }]`
- `source` values: `SYSTEM` (built-in), `IVC` (Inworld Voice Cloning), `PVC` (Professional Voice Cloning)
- SYSTEM voice IDs: plain names (e.g., `"Dennis"`, `"Ashley"`)
- Custom voice IDs: `{workspace}__{voice}` format (double underscore)

### Voice Publishing
- Custom voices created via Inworld platform
- Published voices available via workspace-scoped IDs

### RAGbox Voice Catalog (post BUG-D56-03 fix)
Valid Inworld SYSTEM voice IDs: Ashley, Elizabeth, Olivia, Luna, Dennis, Mark, James, Brian

---

## 2. Realtime WebSocket API

### Endpoint
```
WSS wss://api.inworld.ai/api/v1/realtime/session
```

### Session Configuration (client → server on connect)
```json
{
  "type": "session.update",
  "session": {
    "audio": {
      "input": { "encoding": "pcm16", "sample_rate": 16000 },
      "output": { "encoding": "pcm16", "sample_rate": 24000, "voice": "Dennis" }
    },
    "turn_detection": {
      "type": "server_vad",
      "threshold": 0.5,
      "prefix_padding_ms": 300,
      "silence_duration_ms": 500
    }
  }
}
```

### Client → Server Events
| Event | Purpose |
|-------|---------|
| `session.update` | Configure session (audio format, voice, VAD) |
| `input_audio_buffer.append` | Send audio chunk (base64 PCM16) |
| `input_audio_buffer.clear` | Clear pending audio |
| `input_audio_buffer.commit` | Finalize audio input |

### Server → Client Events
| Event | Purpose |
|-------|---------|
| `session.created` | Session established |
| `session.updated` | Session config confirmed |
| `response.created` | New response started |
| `response.text.delta` | Text transcript chunk |
| `response.text.done` | Text complete |
| `response.audio.delta` | Audio chunk (base64) — **critical for playback** |
| `response.audio.done` | Audio stream complete |
| `response.done` | Full response complete |
| `input_audio_buffer.speech_started` | VAD detected speech start |
| `input_audio_buffer.speech_stopped` | VAD detected speech end |
| `error` | Error event |

### Audio Format
- Input: PCM16, 16kHz sample rate
- Output: PCM16, 24kHz sample rate
- Audio in `input_audio_buffer.append`: base64-encoded
- Audio in `response.audio.delta`: base64-encoded in `delta` field

### Turn Detection Modes
- `server_vad`: Server-side Voice Activity Detection (recommended)
  - `threshold`: 0.0–1.0 (sensitivity)
  - `prefix_padding_ms`: Audio before speech detection
  - `silence_duration_ms`: Silence before end-of-turn
- `semantic_vad`: Semantic turn detection (smarter, considers meaning)

---

## 3. Cloud Deployment

### Deploy Graph
```bash
inworld deploy ./graph.ts
```
Creates persistent endpoint: `https://api.inworld.ai/cloud/workspaces/{workspace}/graphs/{graph-id}/v1/graph`

### Flags
| Flag | Description |
|------|-------------|
| `--info` | Check deployment status and health |
| `--package-only` | Package without deploying |

### Client Integration
```bash
curl -X POST https://api.inworld.ai/cloud/workspaces/{workspace}/graphs/{graph-id}/v1/graph:start \
  -H "Authorization: Basic $(inworld auth print-api-key)" \
  -H "Content-Type: application/json" \
  -d '{"input": {"user_input": "Hello!"}, "userContext": {"targetingKey": "user123"}}'
```

**Key insight:** `inworld deploy` creates a persistent endpoint that auto-updates on redeployment. Zero downtime. Could replace our self-managed mercury-voice Cloud Run service.

---

## 4. Node.js Agent Runtime SDK

### Core Imports
```typescript
import { Graph, GraphBuilder, SubgraphBuilder } from '@inworld/runtime/graph';
import { RemoteLLMChatNode, RemoteTTSNode, RemoteSTTNode } from '@inworld/runtime/graph';
import { RemoteLLMComponent, RemoteTTSComponent, RemoteSTTComponent } from '@inworld/runtime/graph';
```

### Built-in Nodes
| Node | Input | Output | Description |
|------|-------|--------|-------------|
| RemoteLLMChatNode | LLMChatRequest | LLMChatResponse | LLM generation |
| RemoteTTSNode | String / TextStream / TTSRequest | TTSOutputStream | Text-to-speech |
| RemoteSTTNode | Audio | String | Speech-to-text |
| TextChunkingNode | TextStream | TextStream | Split text into chunks |
| TextAggregatorNode | TextStream | String | Combine chunks |
| KnowledgeNode | String | KnowledgeRecords | RAG retrieval |
| TextClassifierNode | String | ClassificationResult | Intent/category classification |
| KeywordMatcherNode | String | MatchedKeywords | Keyword matching |
| LLMPromptBuilderNode | Object | String | Prompt templates |
| MCPCallToolNode | ToolCallRequest | ToolCallResponse | MCP tool calls |
| MCPListToolsNode | any | ListToolsResponse | List MCP tools |
| SubgraphNode | any | any | Execute subgraph as node |
| ProxyNode | any | any | Data passthrough |
| RandomCannedTextNode | any | String | Random predefined text |

### Custom Nodes
Extend `CustomNode` base class for custom processing logic.
Our `RAGboxNode` is a custom node that bridges to Go backend `/api/chat` SSE.

### Components (reusable configs)
- `RemoteLLMComponent` — LLM provider config
- `RemoteTTSComponent` — TTS config
- `RemoteSTTComponent` — STT config
- `RemoteKnowledgeComponent` — Knowledge base config
- `RemoteEmbedderComponent` — Embedding config
- `MCPClientComponent` — MCP server config

### Data Flow Patterns
- **Fan-Out:** A → B, A → C (parallel processing)
- **Fan-In:** A → C, B → C (wait for all inputs)
- **Conditional routing:** Simple expressions or custom functions

---

## 5. TTS Prompting Best Practices

### Emphasis
- `*word*` for emphasis (single asterisks only — double reads them aloud)
- `!` for excitement/urgency
- `...` for trailing off

### Pronunciation
- Inline IPA: `/kriːt/` for "Crete", `/ŋwɪən/` for "Nguyen"
- Pronunciation dictionary in system prompt

### Non-verbal Vocalizations
- `[sigh]` — frustration/relief
- `[laugh]` — amusement
- `[breathe]` — before important statements
- `[cough]` / `[clear_throat]` — transitions
- `[yawn]` — tiredness
- **Experimental, English only**

### Pacing
- Periods = natural pauses
- Commas = shorter breaks
- Short sentences = urgency
- Long sentences = calm delivery

### Normalization
- `applyTextNormalization: ON` — auto-expand dates/numbers/symbols
- `applyTextNormalization: OFF` — LLM must write everything spoken
- Default: TTS decides per-request

---

## 6. Implications for RAGbox

### Mercury Voice (Current)
- Our graph: TextInput → RAGboxNode → TextChunking → TTS
- RAGboxNode = custom node bridging to Go backend
- Uses `@inworld/runtime` (graph SDK), not raw Realtime WebSocket API
- Deployed as standalone Cloud Run: `mercury-voice-100739220279.us-east4.run.app`

### EPIC-029 VERITAS CAST (Upcoming)
- **Cloud deployment option:** `inworld deploy ./graph.ts` could replace self-managed Cloud Run
  - Pro: Auto-scaling, zero downtime updates, persistent endpoint
  - Con: Less control, dependency on Inworld Cloud
- **TTS optimization:** Apply TTS prompting techniques to Mercury responses
  - Emphasis on key facts/citations
  - IPA for legal/financial terminology
  - Pacing for complex explanations
- **Built-in nodes to leverage:**
  - `KnowledgeNode` could augment our RAG (Inworld's knowledge system + our pgvector)
  - `TextClassifierNode` for intent detection (replace our regex-based tool routing?)
  - `MCPCallToolNode` for external tool integration
  - `SubgraphNode` for encapsulating the RAG pipeline as reusable component

### BUG-D56-05 Clarification
- Raw Realtime WebSocket API: ALL JSON (audio = base64 in JSON)
- `@inworld/runtime` graph SDK: MAY send binary audio over internal WS
- Sheldon's fix (isBinary detection) is correct for the runtime SDK behavior
