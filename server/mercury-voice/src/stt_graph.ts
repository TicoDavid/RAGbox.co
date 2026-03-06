import {
  CustomNode,
  ProcessContext,
  RemoteSTTNode,
  ProxyNode,
  GraphBuilder,
  Graph,
} from '@inworld/runtime/graph';
import { GraphTypes } from '@inworld/runtime/common';
import { AudioInput } from './types';

export class STTGraph {
  executor: Graph;

  private constructor({ executor }: { executor: Graph }) {
    this.executor = executor;
  }

  async destroy() {
    if (this.executor) {
      try {
        await this.executor.stop();
      } catch (error: unknown) {
        console.error('Error stopping STT executor (non-fatal):', error);
      }
    }
  }

  static async create(props: { apiKey: string }) {
    const graph = new GraphBuilder('mercury-stt-with-audio-input');

    class AudioFilterNode extends CustomNode {
      process(_context: ProcessContext, input: AudioInput): GraphTypes.Audio {
        return new GraphTypes.Audio({
          data: input.audio.data,
          sampleRate: input.audio.sampleRate,
        });
      }
    }

    const audioInputNode = new ProxyNode();
    const audioFilterNode = new AudioFilterNode();
    const sttNode = new RemoteSTTNode();

    graph
      .addNode(audioInputNode)
      .addNode(audioFilterNode)
      .addNode(sttNode)
      .addEdge(audioInputNode, audioFilterNode)
      .addEdge(audioFilterNode, sttNode)
      .setStartNode(audioInputNode)
      .setEndNode(sttNode);

    // Suppress unused variable — apiKey is set via INWORLD_API_KEY env
    void props.apiKey;

    const executor = graph.build();
    return new STTGraph({ executor });
  }
}
