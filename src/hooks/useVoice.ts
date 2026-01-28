'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type {
  VoiceState,
  ConnectionState,
  MicPermission,
  ResponseContext,
} from '@/lib/voice/types';
import { DeepgramClient } from '@/lib/voice/deepgram-client';
import { AudioCapture } from '@/lib/voice/audio-capture';
import { AudioPlayback } from '@/lib/voice/audio-playback';
import { InworldClient } from '@/lib/voice/inworld-client';

interface UseVoiceOptions {
  onTranscript?: (text: string) => void;
  onUtteranceEnd?: (text: string) => void;
  onError?: (error: Error) => void;
  autoSubmit?: boolean;
}

interface UseVoiceReturn {
  voiceState: VoiceState;
  connectionState: ConnectionState;
  micPermission: MicPermission;
  transcript: string;
  audioLevel: number;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  toggleVoice: () => void;
  startListening: () => Promise<void>;
  stopListening: () => void;
  speak: (text: string, context?: ResponseContext) => Promise<void>;
  stopSpeaking: () => void;
}

export function useVoice(options: UseVoiceOptions = {}): UseVoiceReturn {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [micPermission, setMicPermission] = useState<MicPermission>('prompt');
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  const deepgramRef = useRef<DeepgramClient | null>(null);
  const captureRef = useRef<AudioCapture | null>(null);
  const playbackRef = useRef<AudioPlayback | null>(null);
  const inworldRef = useRef<InworldClient | null>(null);
  const finalTranscriptRef = useRef('');

  // Initialize clients on mount
  useEffect(() => {
    captureRef.current = new AudioCapture();
    playbackRef.current = new AudioPlayback();
    inworldRef.current = new InworldClient();

    // Check mic permission on mount
    captureRef.current.checkPermission().then(setMicPermission);

    return () => {
      deepgramRef.current?.disconnect();
      captureRef.current?.stop();
      playbackRef.current?.dispose();
    };
  }, []);

  const startListening = useCallback(async () => {
    const capture = captureRef.current;
    if (!capture) return;

    // Request mic permission if needed
    if (micPermission !== 'granted') {
      const perm = await capture.requestPermission();
      setMicPermission(perm);
      if (perm === 'denied') {
        options.onError?.(new Error('Microphone permission denied'));
        setVoiceState('error');
        return;
      }
    }

    // Reset transcript
    finalTranscriptRef.current = '';
    setTranscript('');

    // Create Deepgram client with callbacks
    const deepgram = new DeepgramClient({
      onTranscriptInterim: (text) => {
        setTranscript(finalTranscriptRef.current + text);
        options.onTranscript?.(finalTranscriptRef.current + text);
      },
      onTranscriptFinal: (text) => {
        finalTranscriptRef.current += text + ' ';
        setTranscript(finalTranscriptRef.current.trim());
        options.onTranscript?.(finalTranscriptRef.current.trim());
      },
      onUtteranceEnd: () => {
        const finalText = finalTranscriptRef.current.trim();
        if (finalText && options.autoSubmit !== false) {
          options.onUtteranceEnd?.(finalText);
        }
      },
      onConnectionChange: setConnectionState,
      onError: (error) => {
        console.error('[useVoice] Error:', error);
        setVoiceState('error');
        options.onError?.(error);
      },
    });

    deepgramRef.current = deepgram;

    try {
      // Connect Deepgram WebSocket
      await deepgram.connect();

      // Start audio capture, sending chunks to Deepgram
      await capture.start(
        (audioData) => deepgram.sendAudio(audioData),
        (level) => setAudioLevel(level)
      );

      setVoiceState('listening');
    } catch (error) {
      console.error('[useVoice] Start error:', error);
      setVoiceState('error');
      options.onError?.(error as Error);
    }
  }, [micPermission, options]);

  const stopListening = useCallback(() => {
    captureRef.current?.stop();
    deepgramRef.current?.disconnect();
    deepgramRef.current = null;
    setAudioLevel(0);

    if (voiceState === 'listening') {
      setVoiceState('idle');
    }
  }, [voiceState]);

  const speak = useCallback(async (text: string, context?: ResponseContext) => {
    const inworld = inworldRef.current;
    const playback = playbackRef.current;
    if (!inworld || !playback) return;

    setVoiceState('speaking');

    try {
      // Prepare text with emotion tag if context provided
      const preparedText = context
        ? inworld.prepareTextForTTS(text, context)
        : text;

      // Synthesize audio
      const audioData = await inworld.synthesize({ text: preparedText });

      // Play audio
      await playback.play(
        audioData,
        () => {
          // Playback ended
          setVoiceState('idle');
          setAudioLevel(0);
        },
        (level) => setAudioLevel(level)
      );
    } catch (error) {
      console.error('[useVoice] Speak error:', error);
      setVoiceState('error');
      options.onError?.(error as Error);
    }
  }, [options]);

  const stopSpeaking = useCallback(() => {
    playbackRef.current?.stop();
    setAudioLevel(0);
    setVoiceState('idle');
  }, []);

  const toggleVoice = useCallback(() => {
    switch (voiceState) {
      case 'idle':
        startListening();
        break;
      case 'listening':
      case 'processing':
        stopListening();
        break;
      case 'speaking':
        stopSpeaking();
        break;
      case 'error':
        setVoiceState('idle');
        startListening();
        break;
    }
  }, [voiceState, startListening, stopListening, stopSpeaking]);

  return {
    voiceState,
    connectionState,
    micPermission,
    transcript,
    audioLevel,
    isListening: voiceState === 'listening',
    isSpeaking: voiceState === 'speaking',
    isProcessing: voiceState === 'processing',
    toggleVoice,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
