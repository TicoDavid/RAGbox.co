'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface VoiceChatState {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
}

export interface UseVoiceChatReturn extends VoiceChatState {
  startVoiceChat: () => Promise<void>;
  stopVoiceChat: () => void;
  sendTextMessage: (text: string) => void;
  interrupt: () => void;
}

const SAMPLE_RATE = 16000;
const CHUNK_DURATION_MS = 100; // Send audio every 100ms

/**
 * Hook for managing Gemini Live voice chat
 */
export function useVoiceChat(
  onTranscript?: (text: string, isFinal: boolean) => void
): UseVoiceChatReturn {
  const [state, setState] = useState<VoiceChatState>({
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    transcript: '',
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const transcriptRef = useRef('');

  // Play audio from queue
  const playNextAudio = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setState(prev => ({ ...prev, isSpeaking: false }));
      return;
    }

    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    isPlayingRef.current = true;
    setState(prev => ({ ...prev, isSpeaking: true }));

    const samples = audioQueueRef.current.shift()!;
    const audioBuffer = audioContext.createBuffer(1, samples.length, SAMPLE_RATE);
    audioBuffer.copyToChannel(samples, 0);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.onended = playNextAudio;
    source.start();
  }, []);

  // Handle incoming audio data
  const handleAudioData = useCallback((base64Audio: string) => {
    try {
      // Decode base64 to binary
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert to Int16 then Float32
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
      }

      // Add to queue
      audioQueueRef.current.push(float32Array);

      // Start playback if not already playing
      if (!isPlayingRef.current) {
        playNextAudio();
      }
    } catch (error) {
      console.error('[VoiceChat] Error processing audio:', error);
    }
  }, [playNextAudio]);

  // Handle incoming text (transcription)
  const handleTextData = useCallback((text: string) => {
    transcriptRef.current += text;
    setState(prev => ({ ...prev, transcript: transcriptRef.current }));
    onTranscript?.(text, false);
  }, [onTranscript]);

  // Send audio chunk to server
  const sendAudioChunk = useCallback(async (audioBase64: string) => {
    try {
      await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'audio',
          audioData: audioBase64,
        }),
      });
    } catch (error) {
      console.error('[VoiceChat] Error sending audio:', error);
    }
  }, []);

  // Start recording from microphone
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      let audioBuffer: Float32Array[] = [];
      let lastSendTime = Date.now();

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(new Float32Array(inputData));

        // Send audio every CHUNK_DURATION_MS
        const now = Date.now();
        if (now - lastSendTime >= CHUNK_DURATION_MS) {
          // Concatenate buffer
          const totalLength = audioBuffer.reduce((sum, arr) => sum + arr.length, 0);
          const combined = new Float32Array(totalLength);
          let offset = 0;
          for (const arr of audioBuffer) {
            combined.set(arr, offset);
            offset += arr.length;
          }

          // Convert to base64 PCM
          const int16Array = new Int16Array(combined.length);
          for (let i = 0; i < combined.length; i++) {
            const s = Math.max(-1, Math.min(1, combined[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          const bytes = new Uint8Array(int16Array.buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          sendAudioChunk(base64);

          audioBuffer = [];
          lastSendTime = now;
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setState(prev => ({ ...prev, isListening: true }));
    } catch (error) {
      console.error('[VoiceChat] Error starting recording:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to access microphone',
      }));
    }
  }, [sendAudioChunk]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setState(prev => ({ ...prev, isListening: false }));
  }, []);

  // Start voice chat session
  const startVoiceChat = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null, transcript: '' }));
      transcriptRef.current = '';

      // Connect to SSE stream
      const eventSource = new EventSource('/api/voice');
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('connected', () => {
        console.log('[VoiceChat] Connected to Gemini');
        setState(prev => ({ ...prev, isConnected: true }));
        startRecording();
      });

      eventSource.addEventListener('audio', (e) => {
        const data = JSON.parse(e.data);
        handleAudioData(data.data);
      });

      eventSource.addEventListener('text', (e) => {
        const data = JSON.parse(e.data);
        handleTextData(data.content);
      });

      eventSource.addEventListener('turnComplete', () => {
        console.log('[VoiceChat] Turn complete');
        onTranscript?.(transcriptRef.current, true);
        transcriptRef.current = '';
        setState(prev => ({ ...prev, transcript: '' }));
      });

      eventSource.addEventListener('interrupted', () => {
        console.log('[VoiceChat] Interrupted');
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        setState(prev => ({ ...prev, isSpeaking: false }));
      });

      eventSource.addEventListener('error', (e) => {
        if (e instanceof MessageEvent) {
          const data = JSON.parse(e.data);
          console.error('[VoiceChat] Error:', data.message);
          setState(prev => ({ ...prev, error: data.message }));
        } else {
          console.error('[VoiceChat] Connection error');
          setState(prev => ({ ...prev, error: 'Connection lost' }));
        }
      });

      eventSource.addEventListener('disconnected', () => {
        console.log('[VoiceChat] Disconnected');
        setState(prev => ({ ...prev, isConnected: false }));
        stopRecording();
      });

      eventSource.onerror = () => {
        console.error('[VoiceChat] EventSource error');
        setState(prev => ({
          ...prev,
          isConnected: false,
          error: 'Connection failed',
        }));
      };

    } catch (error) {
      console.error('[VoiceChat] Error starting:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start',
      }));
    }
  }, [startRecording, stopRecording, handleAudioData, handleTextData, onTranscript]);

  // Stop voice chat session
  const stopVoiceChat = useCallback(async () => {
    stopRecording();

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Tell server to close session
    try {
      await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
    } catch (error) {
      console.error('[VoiceChat] Error stopping session:', error);
    }

    // Clear audio queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setState({
      isConnected: false,
      isListening: false,
      isSpeaking: false,
      transcript: '',
      error: null,
    });
  }, [stopRecording]);

  // Send text message
  const sendTextMessage = useCallback(async (text: string) => {
    try {
      await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'text',
          text,
        }),
      });
    } catch (error) {
      console.error('[VoiceChat] Error sending text:', error);
    }
  }, []);

  // Interrupt current response
  const interrupt = useCallback(async () => {
    // Clear local audio queue immediately
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setState(prev => ({ ...prev, isSpeaking: false }));

    try {
      await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'interrupt' }),
      });
    } catch (error) {
      console.error('[VoiceChat] Error interrupting:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceChat();
    };
  }, [stopVoiceChat]);

  return {
    ...state,
    startVoiceChat,
    stopVoiceChat,
    sendTextMessage,
    interrupt,
  };
}
