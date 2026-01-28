/**
 * Audio Playback - Speaker Utilities
 *
 * Queued audio playback using AudioBufferSourceNode.
 * Supports volume control, level monitoring, and sequential queue processing.
 */

export class AudioPlayback {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private queue: ArrayBuffer[] = [];
  private isPlaying = false;
  private onEndCallback: (() => void) | null = null;
  private onLevelCallback: ((level: number) => void) | null = null;
  private levelAnimationFrame: number | null = null;

  private initContext(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }
  }

  async play(
    audioData: ArrayBuffer,
    onEnd?: () => void,
    onLevel?: (level: number) => void
  ): Promise<void> {
    this.initContext();
    this.onEndCallback = onEnd || null;
    this.onLevelCallback = onLevel || null;

    this.queue.push(audioData);

    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.stopLevelMonitoring();
      this.onEndCallback?.();
      return;
    }

    this.isPlaying = true;
    const audioData = this.queue.shift()!;

    try {
      const audioBuffer = await this.audioContext!.decodeAudioData(audioData.slice(0));

      this.currentSource = this.audioContext!.createBufferSource();
      this.currentSource.buffer = audioBuffer;
      this.currentSource.connect(this.gainNode!);

      this.currentSource.onended = () => {
        this.currentSource = null;
        this.playNext();
      };

      if (this.onLevelCallback) {
        this.startLevelMonitoring();
      }

      this.currentSource.start();
    } catch (error) {
      console.error('[AudioPlayback] Decode error:', error);
      this.playNext();
    }
  }

  private startLevelMonitoring(): void {
    const updateLevel = () => {
      if (!this.isPlaying || !this.analyser) return;

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(dataArray);

      const sum = dataArray.reduce((a, b) => a + b, 0);
      const average = sum / dataArray.length;

      this.onLevelCallback?.(average);
      this.levelAnimationFrame = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }

  private stopLevelMonitoring(): void {
    if (this.levelAnimationFrame) {
      cancelAnimationFrame(this.levelAnimationFrame);
      this.levelAnimationFrame = null;
    }
  }

  getAudioLevel(): number {
    if (!this.analyser || !this.isPlaying) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    const sum = dataArray.reduce((a, b) => a + b, 0);
    return sum / dataArray.length;
  }

  stop(): void {
    this.queue = [];
    this.stopLevelMonitoring();

    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Source may already be stopped
      }
      this.currentSource = null;
    }

    this.isPlaying = false;
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
