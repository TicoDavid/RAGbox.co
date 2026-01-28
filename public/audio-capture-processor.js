/**
 * AudioWorklet Processor — Float32 to Int16 conversion
 *
 * Receives microphone audio frames, converts from Float32 to Int16 PCM,
 * and posts the buffer back to the main thread for Deepgram STT.
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const float32Data = input[0];
    const int16Data = new Int16Array(float32Data.length);

    for (let i = 0; i < float32Data.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Data[i]));
      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    this.port.postMessage(int16Data.buffer, [int16Data.buffer]);
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
