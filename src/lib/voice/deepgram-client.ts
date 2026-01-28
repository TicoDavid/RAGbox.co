/**
 * Deepgram STT WebSocket Client
 *
 * Connects to Deepgram Nova-2 for real-time speech-to-text
 * with automatic reconnection and keepalive.
 */

import {
  ConnectionState,
  DeepgramMessage,
  TranscriptResult,
  VoiceCallbacks,
} from './types';

export class DeepgramClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECTS = 3;
  private callbacks: VoiceCallbacks = {};
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  constructor(callbacks?: VoiceCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  getState(): ConnectionState {
    return this.state;
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.callbacks.onConnectionChange?.(state);
  }

  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.setState('connecting');

    try {
      // Get token from our API
      const tokenRes = await fetch('/api/voice/token', { method: 'POST' });
      if (!tokenRes.ok) {
        throw new Error('Failed to get voice token');
      }
      const { key } = await tokenRes.json();

      // Build WebSocket URL
      const model = process.env.NEXT_PUBLIC_DEEPGRAM_MODEL || 'nova-2';
      const params = new URLSearchParams({
        model,
        punctuate: 'true',
        interim_results: 'true',
        utterance_end_ms: '1500',
        vad_events: 'true',
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1',
      });

      const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

      this.ws = new WebSocket(url, ['token', key]);

      this.ws.onopen = () => {
        console.log('[Deepgram] Connected');
        this.setState('connected');
        this.reconnectAttempts = 0;
        this.startKeepAlive();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data as string);
      };

      this.ws.onerror = () => {
        console.error('[Deepgram] WebSocket error');
        this.callbacks.onError?.(new Error('Voice connection error'));
      };

      this.ws.onclose = (event) => {
        console.log('[Deepgram] Disconnected:', event.code, event.reason);
        this.stopKeepAlive();
        this.handleClose();
      };
    } catch (error) {
      console.error('[Deepgram] Connection error:', error);
      this.setState('error');
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  private handleMessage(data: string): void {
    try {
      const message: DeepgramMessage = JSON.parse(data);

      if (message.type === 'Results' && message.channel?.alternatives?.[0]) {
        const alt = message.channel.alternatives[0];
        const result: TranscriptResult = {
          transcript: alt.transcript,
          confidence: alt.confidence,
          isFinal: message.is_final || false,
          words: alt.words,
        };

        if (result.transcript) {
          if (result.isFinal) {
            this.callbacks.onTranscriptFinal?.(result.transcript, result.confidence);
          } else {
            this.callbacks.onTranscriptInterim?.(result.transcript);
          }
        }
      } else if (message.type === 'UtteranceEnd') {
        this.callbacks.onUtteranceEnd?.();
      }
    } catch (error) {
      console.error('[Deepgram] Message parse error:', error);
    }
  }

  private handleClose(): void {
    this.ws = null;

    if (this.state === 'connected' && this.reconnectAttempts < this.MAX_RECONNECTS) {
      this.setState('reconnecting');
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts - 1) * 1000;
      console.log(`[Deepgram] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    } else if (this.reconnectAttempts >= this.MAX_RECONNECTS) {
      this.setState('error');
      this.callbacks.onError?.(new Error('Voice connection failed after retries'));
    } else {
      this.setState('disconnected');
    }
  }

  private startKeepAlive(): void {
    this.keepAliveInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, 20000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  sendAudio(audioData: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    }
  }

  disconnect(): void {
    this.stopKeepAlive();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
    this.reconnectAttempts = 0;
  }
}
