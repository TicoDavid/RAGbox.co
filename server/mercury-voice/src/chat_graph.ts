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
import { VoiceGraphOpts } from './types';

/**
 * Build the Mercury chat graph:
 *   RAGboxNode → TextChunkingNode → RemoteTTSNode
 *
 * Accepts per-user voice settings from session JWT claims.
 */
export function buildChatGraph(opts: VoiceGraphOpts = {}): Graph {
  const ragboxNode = new RAGboxNode({
    id: 'ragbox-node',
  });

  const textChunkingNode = new TextChunkingNode({
    id: 'text-chunking-node',
  });

  const ttsNode = new RemoteTTSNode({
    id: 'tts-node',
    speakerId: opts.voiceId || DEFAULT_VOICE_ID,
    modelId: DEFAULT_TTS_MODEL_ID,
    sampleRate: TTS_SAMPLE_RATE,
    temperature: opts.temperature ?? 0.6,
    speakingRate: opts.speakingRate ?? 1.05,
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
