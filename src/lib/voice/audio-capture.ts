/**
 * Audio Capture - Microphone Utilities
 *
 * Captures microphone audio at 16kHz mono, converts Float32 to Int16
 * for Deepgram STT. Includes echo cancellation, noise suppression,
 * and auto gain control.
 */

import { MicPermission } from './types';

export class AudioCapture {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private onChunkCallback: ((data: ArrayBuffer) => void) | null = null;
  private onLevelCallback: ((level: number) => void) | null = null;
  private isCapturing = false;
  private levelAnimationFrame: number | null = null;

  async checkPermission(): Promise<MicPermission> {
    try {
      const result = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      if (result.state === 'granted') return 'granted';
      if (result.state === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  async requestPermission(): Promise<MicPermission> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      stream.getTracks().forEach(track => track.stop());
      return 'granted';
    } catch (error) {
      if ((error as Error).name === 'NotAllowedError') {
        return 'denied';
      }
      throw error;
    }
  }

  async start(
    onChunk: (data: ArrayBuffer) => void,
    onLevel?: (level: number) => void
  ): Promise<void> {
    if (this.isCapturing) return;

    this.onChunkCallback = onChunk;
    this.onLevelCallback = onLevel || null;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.stream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event) => {
        if (!this.isCapturing) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const int16Data = new Int16Array(inputData.length);

        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        this.onChunkCallback?.(int16Data.buffer);
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      if (onLevel) {
        this.startLevelMonitoring();
      }

      this.isCapturing = true;
      console.log('[AudioCapture] Started');
    } catch (error) {
      console.error('[AudioCapture] Start error:', error);
      this.stop();
      throw error;
    }
  }

  private startLevelMonitoring(): void {
    const updateLevel = () => {
      if (!this.isCapturing || !this.analyser) return;

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(dataArray);

      const sum = dataArray.reduce((a, b) => a + b, 0);
      const average = sum / dataArray.length;

      this.onLevelCallback?.(average);
      this.levelAnimationFrame = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }

  getAudioLevel(): number {
    if (!this.analyser) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    const sum = dataArray.reduce((a, b) => a + b, 0);
    return sum / dataArray.length;
  }

  stop(): void {
    this.isCapturing = false;

    if (this.levelAnimationFrame) {
      cancelAnimationFrame(this.levelAnimationFrame);
      this.levelAnimationFrame = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    console.log('[AudioCapture] Stopped');
  }

  isActive(): boolean {
    return this.isCapturing;
  }
}
