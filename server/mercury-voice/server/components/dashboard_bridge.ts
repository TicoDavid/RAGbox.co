/**
 * DashboardBridge — translates the RAGbox dashboard voice protocol
 * to the Inworld graph pipeline.
 *
 * Dashboard protocol (client ↔ server):
 *   Client → Server:
 *     {type:'start'}          — begin audio capture
 *     {type:'stop'}           — stop capture, process audio
 *     {type:'barge_in'}       — interrupt TTS playback
 *     {type:'text', text}     — text query (push-to-talk or typed)
 *     Binary ArrayBuffer      — Int16 PCM audio chunks
 *
 *   Server → Client:
 *     {type:'state', state}          — idle|listening|processing|speaking
 *     {type:'asr_partial', text}     — partial transcript
 *     {type:'asr_final', text}       — final transcript
 *     {type:'agent_text_partial', text} — streaming agent response
 *     {type:'agent_text_final', text}   — complete agent response
 *     {type:'error', message}        — error
 *     {type:'config', ...}           — server config on connect
 *     Binary ArrayBuffer             — Int16 TTS audio chunks
 */

import { GraphOutputStream, GraphTypes } from '@inworld/runtime/graph';
import { v4 } from 'uuid';
import { WebSocket } from 'ws';

import { INPUT_SAMPLE_RATE, TTS_SAMPLE_RATE } from '../../constants';
import { TextInput } from '../types';
import { InworldApp } from './app';
import { AudioStreamManager } from './audio_stream_manager';
import { InworldGraphWrapper } from './graph';

interface DashboardBridgeConfig {
  userId: string;
  role: string;
  privilegeMode: boolean;
}

export class DashboardBridge {
  private sessionId: string;
  private agentText = '';
  private audioStreamManager?: AudioStreamManager;
  private currentAudioGraphExecution?: Promise<void>;
  private isCapturing = false;

  // Queue for sequential graph execution
  private processingQueue: (() => Promise<void>)[] = [];
  private isProcessing = false;

  constructor(
    private ws: WebSocket,
    private inworldApp: InworldApp,
    private config: DashboardBridgeConfig,
  ) {
    this.sessionId = `dashboard-${v4()}`;
  }

  async initialize() {
    const agent = {
      id: v4(),
      name: 'Mercury',
      description: 'RAGbox AI voice assistant',
      motivation: 'Help users query their document knowledge base',
      systemPrompt: [
        'You are Mercury, the RAGbox AI voice assistant.',
        'You help users find information in their documents.',
        'Be concise and natural — this is a voice conversation.',
        "The user's name is {userName}.",
      ].join(' '),
    };

    const systemMessageId = v4();

    this.inworldApp.connections[this.sessionId] = {
      state: {
        interactionId: systemMessageId,
        messages: [
          {
            role: 'system',
            content: agent.systemPrompt.replace('{userName}', 'User'),
            id: 'system' + systemMessageId,
          },
        ],
        agent,
        userName: 'User',
        voiceId: 'Alex',
      },
      ws: this.ws,
    };

    this.sendJSON({ type: 'state', state: 'idle' });
    this.sendJSON({
      type: 'config',
      ttsSampleRate: TTS_SAMPLE_RATE,
      inputSampleRate: INPUT_SAMPLE_RATE,
    });

    console.log(
      `[DashboardBridge] Session ${this.sessionId} initialized (user=${this.config.userId})`,
    );
  }

  // ---------------------------------------------------------------------------
  // Incoming message router
  // ---------------------------------------------------------------------------

  async handleMessage(data: any) {
    // Binary data = audio PCM chunk
    if (data instanceof Buffer || data instanceof ArrayBuffer) {
      if (this.isCapturing) {
        this.pushAudioChunk(
          data instanceof ArrayBuffer ? Buffer.from(data) : data,
        );
      }
      return;
    }

    let msg: any;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'start':
        this.startAudioCapture();
        break;

      case 'stop':
        this.stopAudioCapture();
        break;

      case 'barge_in':
        this.handleBargeIn();
        break;

      case 'text':
        if (msg.text?.trim()) {
          this.addToQueue(() => this.handleTextInput(msg.text.trim()));
        }
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Audio capture (server-side STT via Assembly.AI)
  // ---------------------------------------------------------------------------

  private startAudioCapture() {
    this.isCapturing = true;
    this.agentText = '';
    this.audioStreamManager = new AudioStreamManager();

    this.sendJSON({ type: 'state', state: 'listening' });
    console.log(`[DashboardBridge] Audio capture started`);

    // Start audio graph execution in background
    this.currentAudioGraphExecution = this.runAudioGraph().catch(
      (err: Error) => {
        console.error('[DashboardBridge] Audio graph error:', err);
        this.sendJSON({
          type: 'error',
          message: err.message || 'Error processing audio',
        });
      },
    );
  }

  private pushAudioChunk(buffer: Buffer) {
    if (!this.audioStreamManager) return;

    const int16 = new Int16Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.length / 2,
    );

    // Downsample from client rate (48 kHz default) to INPUT_SAMPLE_RATE (16 kHz)
    const ratio = Math.round(48000 / INPUT_SAMPLE_RATE); // 3
    const downsampled: number[] = [];
    for (let i = 0; i < int16.length; i += ratio) {
      downsampled.push(int16[i]);
    }

    this.audioStreamManager.pushChunk({
      data: downsampled,
      sampleRate: INPUT_SAMPLE_RATE,
    });
  }

  private stopAudioCapture() {
    this.isCapturing = false;
    this.sendJSON({ type: 'state', state: 'processing' });

    // End the audio stream — graph will finish processing remaining audio
    if (this.audioStreamManager) {
      this.audioStreamManager.end();
    }

    // Wait for audio graph to complete, then finalize
    if (this.currentAudioGraphExecution) {
      this.currentAudioGraphExecution.then(() => {
        this.finalizeAgentResponse();
      });
    }
  }

  private handleBargeIn() {
    this.agentText = '';
    if (this.audioStreamManager) {
      this.audioStreamManager.end();
    }
  }

  private async runAudioGraph() {
    const connection = this.inworldApp.connections[this.sessionId];
    if (!connection) {
      throw new Error(`No connection for session ${this.sessionId}`);
    }

    const graphWrapper = await this.inworldApp.getGraphForSTTService(
      'assemblyai',
    );
    const mgr = this.audioStreamManager!;

    async function* audioStreamGenerator() {
      for await (const audioChunk of mgr.createStream()) {
        yield audioChunk;
      }
    }

    const taggedStream = Object.assign(audioStreamGenerator(), {
      _iw_type: 'Audio' as const,
    });

    const { outputStream } = await graphWrapper.graph.start(taggedStream, {
      dataStoreContent: {
        sessionId: this.sessionId,
        state: connection.state,
      },
    });

    await this.processGraphOutput(outputStream);

    // Clean up
    this.audioStreamManager = undefined;
    this.currentAudioGraphExecution = undefined;
  }

  // ---------------------------------------------------------------------------
  // Text input (text-only graph — no STT needed)
  // ---------------------------------------------------------------------------

  private async handleTextInput(text: string) {
    this.agentText = '';
    this.sendJSON({ type: 'state', state: 'processing' });
    this.sendJSON({ type: 'asr_final', text });

    const interactionId = v4();
    const textInput: TextInput = {
      text,
      interactionId,
      sessionId: this.sessionId,
    };

    const connection = this.inworldApp.connections[this.sessionId];
    if (!connection) {
      this.sendJSON({ type: 'error', message: 'Session not found' });
      return;
    }

    try {
      const { outputStream } =
        await this.inworldApp.graphWithTextInput.graph.start(textInput, {
          dataStoreContent: {
            sessionId: this.sessionId,
            state: connection.state,
          },
        });

      await this.processGraphOutput(outputStream);
    } catch (err: any) {
      console.error('[DashboardBridge] Text graph error:', err);
      this.sendJSON({
        type: 'error',
        message: err.message || 'Error processing query',
      });
    }

    this.finalizeAgentResponse();
  }

  // ---------------------------------------------------------------------------
  // Graph output → dashboard protocol translation
  // ---------------------------------------------------------------------------

  private async processGraphOutput(outputStream: GraphOutputStream) {
    try {
      for await (const result of outputStream) {
        if (result?.isGraphError?.()) {
          const errorData = result.data;
          console.error(
            `[DashboardBridge] Graph error:`,
            errorData?.message || errorData,
          );
          this.sendJSON({
            type: 'error',
            message: errorData?.message || 'Graph processing error',
          });
          continue;
        }

        await this.processResult(result);
      }
    } catch (err: any) {
      console.error('[DashboardBridge] Output stream error:', err);
      if (!err.message?.includes('recognition produced no text')) {
        this.sendJSON({
          type: 'error',
          message: err.message || 'Processing error',
        });
      }
    }
  }

  private async processResult(result: any) {
    try {
      await result.processResponse({
        // TTS audio + text chunks from the voice pipeline
        TTSOutputStream: async (ttsStream: GraphTypes.TTSOutputStream) => {
          let isFirstChunk = true;

          for await (const chunk of ttsStream) {
            if (!chunk.audio?.data) continue;

            // Signal "speaking" on first audio chunk
            if (isFirstChunk) {
              this.sendJSON({ type: 'state', state: 'speaking' });
              isFirstChunk = false;
            }

            // Accumulate response text
            if (chunk.text) {
              this.agentText += chunk.text;
              this.sendJSON({
                type: 'agent_text_partial',
                text: this.agentText,
              });
            }

            // Send TTS audio as binary Int16 PCM
            this.sendTTSAudio(chunk.audio.data);
          }
        },

        // Custom data from graph nodes (State, InteractionInfo, SpeechComplete)
        Custom: async (customData: GraphTypes.Custom<any>) => {
          // VAD speech-complete event — not needed for dashboard
          if (customData.type === 'SPEECH_COMPLETE') {
            return;
          }

          // Interruption event
          if ('isInterrupted' in customData && customData.isInterrupted) {
            return;
          }

          // State update (has messages array)
          if ('messages' in customData) {
            const lastMsg = customData.messages.at(-1);
            if (lastMsg?.role === 'user') {
              this.sendJSON({ type: 'asr_final', text: lastMsg.content });
            }
            // Assistant messages come through TTSOutputStream — no duplicate
          }
        },

        // Error handler
        error: async (error: GraphTypes.GraphError) => {
          console.error('[DashboardBridge] Node error:', error.message);
          if (!error.message.includes('recognition produced no text')) {
            this.sendJSON({ type: 'error', message: error.message });
          }
        },

        // Ignore unhandled types
        default: () => {},
      });
    } catch (err: any) {
      if (!err.message?.includes('recognition produced no text')) {
        console.error('[DashboardBridge] processResult error:', err);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // TTS audio conversion (Float32 → Int16 binary)
  // ---------------------------------------------------------------------------

  private sendTTSAudio(audioData: any) {
    let audioBuffer: Buffer;

    if (Array.isArray(audioData)) {
      audioBuffer = Buffer.from(audioData);
    } else if (typeof audioData === 'string') {
      audioBuffer = Buffer.from(audioData, 'base64');
    } else if (Buffer.isBuffer(audioData)) {
      audioBuffer = audioData;
    } else {
      return;
    }

    if (audioBuffer.byteLength === 0) return;

    // TTS audio is Float32 — convert to Int16 for the dashboard player
    const float32 = new Float32Array(
      audioBuffer.buffer,
      audioBuffer.byteOffset,
      audioBuffer.byteLength / 4,
    );
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(Buffer.from(int16.buffer));
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private finalizeAgentResponse() {
    if (this.agentText) {
      this.sendJSON({ type: 'agent_text_final', text: this.agentText });
    }
    this.sendJSON({ type: 'state', state: 'idle' });
    this.agentText = '';
  }

  private sendJSON(data: any) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private addToQueue(task: () => Promise<void>) {
    this.processingQueue.push(task);
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    while (this.processingQueue.length > 0) {
      const task = this.processingQueue.shift();
      if (task) {
        try {
          await task();
        } catch (err) {
          console.error('[DashboardBridge] Queue error:', err);
        }
      }
    }
    this.isProcessing = false;
  }

  cleanup() {
    if (this.audioStreamManager) {
      this.audioStreamManager.end();
    }
    delete this.inworldApp.connections[this.sessionId];
    console.log(`[DashboardBridge] Session ${this.sessionId} cleaned up`);
  }
}
