import {
  GraphBuilder,
  RemoteTTSNode,
  TextChunkingNode,
  Graph,
} from '@inworld/runtime/graph';
import {
  DEFAULT_TTS_MODEL_ID,
  DEFAULT_VOICE_ID,
  TTS_SAMPLE_RATE,
} from './constants';
import { RAGboxNode } from './ragbox_node';

/**
 * Build the Mercury chat graph:
 *   RAGboxNode → TextChunkingNode → RemoteTTSNode
 *
 * RAGboxNode calls the Go backend /api/chat for RAG answers.
 * TextChunkingNode splits long responses into TTS-friendly chunks.
 * RemoteTTSNode synthesizes speech via Inworld TTS.
 */
export function buildChatGraph(voiceId?: string): Graph {
  const ragboxNode = new RAGboxNode({
    id: 'ragbox-node',
  });

  const textChunkingNode = new TextChunkingNode({
    id: 'text-chunking-node',
  });

  const ttsNode = new RemoteTTSNode({
    id: 'tts-node',
    speakerId: voiceId || DEFAULT_VOICE_ID,
    modelId: DEFAULT_TTS_MODEL_ID,
    sampleRate: TTS_SAMPLE_RATE,
    temperature: 0.6,
    speakingRate: 1.05,
  });

  const graph = new GraphBuilder({
    id: 'mercury-chat',
    apiKey: process.env.INWORLD_API_KEY!,
  })
    .addNode(ragboxNode)
    .addNode(textChunkingNode)
    .addNode(ttsNode)
    .addEdge(ragboxNode, textChunkingNode)
    .addEdge(textChunkingNode, ttsNode)
    .setStartNode(ragboxNode)
    .setEndNode(ttsNode)
    .build();

  return graph;
}
