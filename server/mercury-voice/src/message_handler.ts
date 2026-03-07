import { v4 } from 'uuid';
import { RawData } from 'ws';
import type { VAD } from '@inworld/runtime/primitives/vad';
import { Graph, GraphOutputStream } from '@inworld/runtime/graph';
import { TTSOutputStreamIterator } from '@inworld/runtime/common';
import {
  FRAME_PER_BUFFER,
  INPUT_SAMPLE_RATE,
  MIN_SPEECH_DURATION_MS,
  PAUSE_DURATION_THRESHOLD_MS,
  SPEECH_THRESHOLD,
} from './constants';
import { AudioInput, EVENT_TYPE, MercurySession, VoiceGraphOpts } from './types';
import { EventFactory } from './event_factory';
import { STTGraph } from './stt_graph';

const MAX_HISTORY_TURNS = 20;

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export class MessageHandler {
  private pauseDuration = 0;
  private isCapturingSpeech = false;
  private speechBuffer: number[] = [];
  private processingQueue: (() => Promise<void>)[] = [];
  private isProcessing = false;

  // Chat graph executor (reuse per connection)
  private chatExecutor: Graph | null = null;

  // Conversation memory (per-session, in-memory)
  private conversationHistory: ConversationTurn[] = [];

  constructor(
    private sttGraph: STTGraph,
    private vadClient: VAD | null,
    private send: (data: Record<string, unknown>) => void,
    private sendBinary: (data: Buffer) => void,
    private chatGraphBuilder: (opts: VoiceGraphOpts) => Graph,
    private session: MercurySession
  ) {}

  private ensureChatExecutor(): Graph {
    if (!this.chatExecutor) {
      this.chatExecutor = this.chatGraphBuilder({
        voiceId: this.session.voiceId,
        temperature: this.session.temperature,
        speakingRate: this.session.speakingRate,
      });
    }
    return this.chatExecutor;
  }

  async handleMessage(data: RawData, isBinary: boolean, key: string) {
    // BUG-D56-05: Binary audio frames must NOT hit JSON.parse.
    // Binary WebSocket messages are raw PCM audio from the client microphone.
    if (isBinary || Buffer.isBuffer(data) && !data.toString('utf8', 0, 1).startsWith('{')) {
      // Raw binary audio — convert to Int16 samples and feed to VAD pipeline
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      const int16 = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
      const audioBuffer = Array.from(int16) as number[];

      if (audioBuffer.length >= FRAME_PER_BUFFER && this.vadClient) {
        const audioChunk = {
          data: audioBuffer,
          sampleRate: INPUT_SAMPLE_RATE,
        };
        const vadResult = await this.vadClient.detectVoiceActivity(
          audioChunk,
          SPEECH_THRESHOLD
        );

        if (this.isCapturingSpeech) {
          this.speechBuffer.push(...audioChunk.data);
          if (vadResult === -1) {
            this.pauseDuration +=
              (audioChunk.data.length * 2000) / INPUT_SAMPLE_RATE;
            if (this.pauseDuration > PAUSE_DURATION_THRESHOLD_MS) {
              this.isCapturingSpeech = false;
              const speechDuration =
                (this.speechBuffer.length * 2000) / INPUT_SAMPLE_RATE;
              if (speechDuration > MIN_SPEECH_DURATION_MS) {
                await this.processCapturedSpeech(key, v4());
              }
            }
          } else {
            this.pauseDuration = 0;
          }
        } else {
          if (vadResult !== -1) {
            this.isCapturingSpeech = true;
            this.speechBuffer.push(...audioChunk.data);
            this.pauseDuration = 0;
          }
        }
      }
      return;
    }

    const message = JSON.parse(data.toString());
    const interactionId = v4();

    switch (message.type) {
      case EVENT_TYPE.TEXT: {
        this.addToQueue(() =>
          this.executeChat({
            text: message.text,
            interactionId,
            key,
          })
        );
        break;
      }

      case EVENT_TYPE.AUDIO: {
        const audioBuffer: number[] = [];
        for (let i = 0; i < message.audio.length; i++) {
          Object.values(message.audio[i]).forEach((value) => {
            if (typeof value === 'number') {
              audioBuffer.push(value);
            }
          });
        }

        if (audioBuffer.length >= FRAME_PER_BUFFER && this.vadClient) {
          const audioChunk = {
            data: audioBuffer,
            sampleRate: INPUT_SAMPLE_RATE,
          };
          const vadResult = await this.vadClient.detectVoiceActivity(
            audioChunk,
            SPEECH_THRESHOLD
          );

          if (this.isCapturingSpeech) {
            this.speechBuffer.push(...audioChunk.data);
            if (vadResult === -1) {
              this.pauseDuration +=
                (audioChunk.data.length * 2000) / INPUT_SAMPLE_RATE;
              if (this.pauseDuration > PAUSE_DURATION_THRESHOLD_MS) {
                this.isCapturingSpeech = false;
                const speechDuration =
                  (this.speechBuffer.length * 2000) / INPUT_SAMPLE_RATE;
                if (speechDuration > MIN_SPEECH_DURATION_MS) {
                  await this.processCapturedSpeech(key, interactionId);
                }
              }
            } else {
              this.pauseDuration = 0;
            }
          } else {
            if (vadResult !== -1) {
              this.isCapturingSpeech = true;
              this.speechBuffer.push(...audioChunk.data);
              this.pauseDuration = 0;
            }
          }
        }
        break;
      }

      case EVENT_TYPE.AUDIO_SESSION_END:
        this.pauseDuration = 0;
        this.isCapturingSpeech = false;
        if (this.speechBuffer.length > 0) {
          await this.processCapturedSpeech(key, interactionId);
        }
        break;

      case 'start':
        // Client-side VAD detected speech start — reset capture state
        this.isCapturingSpeech = true;
        this.speechBuffer = [];
        this.pauseDuration = 0;
        break;

      case 'stop':
        // Client-side VAD detected speech end — flush and process
        this.isCapturingSpeech = false;
        this.pauseDuration = 0;
        if (this.speechBuffer.length > 0) {
          this.addToQueue(() =>
            this.processCapturedSpeech(key, interactionId)
          );
        }
        break;
    }
  }

  private normalizeAudio(audioBuffer: number[]): number[] {
    let maxVal = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      maxVal = Math.max(maxVal, Math.abs(audioBuffer[i]));
    }
    if (maxVal === 0) return audioBuffer;
    return audioBuffer.map((v) => v / maxVal);
  }

  private async processCapturedSpeech(key: string, interactionId: string) {
    try {
      const input: AudioInput = {
        audio: {
          data: this.normalizeAudio(this.speechBuffer),
          sampleRate: INPUT_SAMPLE_RATE,
        },
        state: {
          agent: {
            id: 'mercury',
            name: 'Mercury',
            description: 'RAGbox voice assistant',
            motivation: 'Help users query their document vault',
          },
          userName: 'User',
          messages: [],
          imageUrl: '',
        },
        interactionId,
        key,
      };

      this.speechBuffer = [];

      // First: STT to get text
      this.addToQueue(() => this.executeSTTThenChat(input, interactionId, key));
    } catch (error) {
      console.error('Error processing captured speech:', error);
    }
  }

  /**
   * STT → Chat pipeline: transcribe audio, then send text through RAGbox chat graph.
   */
  private async executeSTTThenChat(
    input: AudioInput,
    interactionId: string,
    _key: string
  ) {
    try {
      // Step 1: STT
      const sttResult = await this.sttGraph.executor.start(input, {
        executionId: v4(),
      });
      const sttOutput = await sttResult.outputStream.next();
      const transcribedText = sttOutput.data as string;

      if (!transcribedText || transcribedText.trim().length === 0) {
        return; // Empty speech — skip silently
      }

      console.log(`[STT] Transcribed: "${transcribedText}"`);

      // Send user's transcribed text back to client
      this.send(
        EventFactory.text(transcribedText, interactionId, {
          isUser: true,
          name: 'User',
        })
      );

      // Step 2: Chat
      await this.executeChat({ text: transcribedText, interactionId, key: _key });
    } catch (error) {
      // Ignore "no text" STT errors
      const msg = error instanceof Error ? error.message : String(error);
      if (!msg.includes('recognition produced no text')) {
        console.error('[STT→Chat] Error:', error);
        this.send(
          EventFactory.error(
            error instanceof Error ? error : new Error(msg),
            interactionId
          )
        );
      }
    }
  }

  private addTurn(role: 'user' | 'assistant', content: string) {
    this.conversationHistory.push({ role, content });
    if (this.conversationHistory.length > MAX_HISTORY_TURNS) {
      this.conversationHistory = this.conversationHistory.slice(-MAX_HISTORY_TURNS);
    }
  }

  /**
   * Execute the RAGbox chat graph with text input → TTS audio output.
   * Includes conversation history for context continuity.
   */
  private async executeChat({
    text,
    interactionId,
    key: _key,
  }: {
    text: string;
    interactionId: string;
    key: string;
  }) {
    // Track user turn
    this.addTurn('user', text);

    try {
      const executor = this.ensureChatExecutor();

      const chatInput = {
        text,
        userId: this.session.userId,
        personaId: this.session.personaId,
        threadId: this.session.threadId,
        conversationHistory: this.conversationHistory.slice(0, -1), // exclude current query
        userContext: undefined,
      };

      const executionResult = await executor.start(chatInput, {
        executionId: v4(),
      });

      try {
        const responseText = await this.handleTTSResponse(
          executionResult.outputStream,
          interactionId
        );
        // Track assistant response
        if (responseText) {
          this.addTurn('assistant', responseText);
        }
      } finally {
        this.send(EventFactory.interactionEnd(interactionId));
      }
    } catch (error) {
      console.error('[Chat] Error:', error);
      this.send(
        EventFactory.error(
          error instanceof Error ? error : new Error(String(error)),
          interactionId
        )
      );
    }
  }

  private async handleTTSResponse(
    outputStream: GraphOutputStream,
    interactionId: string
  ): Promise<string> {
    const textParts: string[] = [];

    try {
      const result = await outputStream.next();
      const ttsStream = result.data as TTSOutputStreamIterator;

      if (ttsStream?.next) {
        let chunk = await ttsStream.next();

        while (!chunk.done) {
          // Send text chunk
          if (chunk.text) {
            textParts.push(chunk.text);
            this.send(
              EventFactory.text(chunk.text, interactionId, {
                isAgent: true,
                name: 'Mercury',
              })
            );
          }

          // Send audio chunk as binary Int16 PCM with 4-byte sampleRate header
          if (chunk.audio && chunk.audio.data) {
            let float32Array: Float32Array;
            if (typeof chunk.audio.data === 'string') {
              const decodedData = Buffer.from(chunk.audio.data, 'base64');
              float32Array = new Float32Array(decodedData.buffer);
            } else {
              const byteArray = new Uint8Array(
                chunk.audio.data as ArrayLike<number>
              );
              float32Array = new Float32Array(
                byteArray.buffer,
                byteArray.byteOffset,
                byteArray.byteLength / 4
              );
            }

            // Convert Float32 (-1..1) → Int16 PCM
            const int16 = new Int16Array(float32Array.length);
            for (let i = 0; i < float32Array.length; i++) {
              const s = Math.max(-1, Math.min(1, float32Array[i]));
              int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            // Binary frame: [4-byte LE sampleRate][Int16 PCM payload]
            const header = Buffer.alloc(4);
            header.writeUInt32LE(chunk.audio.sampleRate || 48000);
            this.sendBinary(
              Buffer.concat([header, Buffer.from(int16.buffer, int16.byteOffset, int16.byteLength)])
            );
          }

          chunk = await ttsStream.next();
        }
      }
    } catch (error) {
      console.error('[TTS] Error:', error);
      this.send(
        EventFactory.error(
          error instanceof Error ? error : new Error(String(error)),
          interactionId
        )
      );
    }

    return textParts.join('');
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
        } catch (error) {
          console.error('Error processing task from queue:', error);
        }
      }
    }
    this.isProcessing = false;
  }

  async destroy() {
    if (this.chatExecutor) {
      try {
        await this.chatExecutor.stop();
      } catch {
        // Ignore stop errors
      }
      this.chatExecutor = null;
    }
  }
}
