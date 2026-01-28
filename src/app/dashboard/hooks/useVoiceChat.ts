'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { DeepgramClient } from '@/lib/voice/deepgram-client';
import { AudioCapture } from '@/lib/voice/audio-capture';
import { AudioPlayback } from '@/lib/voice/audio-playback';
import { InworldClient } from '@/lib/voice/inworld-client';
import type { ResponseContext } from '@/lib/voice/types';

// Voice type kept for API compatibility (Inworld voices)
export type TTSVoice = 'aria' | 'luke' | 'nova' | 'echo' | 'sage';

export interface VoiceChatState {
  isConnected: boolean;
  isListening: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
  voice: TTSVoice;
}

export interface UseVoiceChatReturn extends VoiceChatState {
  startVoiceChat: () => Promise<void>;
  stopVoiceChat: () => void;
  toggleRecording: () => void;
  interrupt: () => void;
  setVoice: (voice: TTSVoice) => void;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface VoiceChatOptions {
  getContext?: () => string[];
  getChatHistory?: () => ChatHistoryMessage[];
  getSystemPrompt?: () => string;
}

// Silence detection timeout (2 seconds after last speech)
const SILENCE_TIMEOUT_MS = 2000;

/**
 * Voice chat hook using Deepgram STT + Inworld TTS
 *
 * Manual Toggle Mode:
 * - Click mic to START voice session + recording
 * - Click mic again to STOP recording (or wait 2s silence)
 * - Right-click to end session entirely
 *
 * Flow:
 * 1. User clicks mic -> Deepgram connects, mic captures audio
 * 2. User speaks -> Deepgram streams transcript in real-time
 * 3. Utterance ends (1.5s silence) OR user clicks stop -> transcript sent to /api/chat
 * 4. Response synthesized via Inworld TTS and played back
 */
export function useVoiceChat(
  onTranscript?: (userText: string, aiResponse: string) => void,
  options?: VoiceChatOptions
): UseVoiceChatReturn {
  const { getContext, getChatHistory, getSystemPrompt } = options || {};

  const [state, setState] = useState<VoiceChatState>({
    isConnected: false,
    isListening: false,
    isRecording: false,
    isSpeaking: false,
    transcript: '',
    error: null,
    voice: 'aria',
  });

  const deepgramRef = useRef<DeepgramClient | null>(null);
  const captureRef = useRef<AudioCapture | null>(null);
  const playbackRef = useRef<AudioPlayback | null>(null);
  const inworldRef = useRef<InworldClient | null>(null);
  const isActiveRef = useRef(false);
  const isRecordingRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedTranscriptRef = useRef('');

  // Initialize playback + inworld clients once
  useEffect(() => {
    playbackRef.current = new AudioPlayback();
    inworldRef.current = new InworldClient();

    return () => {
      playbackRef.current?.dispose();
    };
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Process the accumulated transcript — send to RAG + TTS
  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim()) return;

    console.log('[VoiceChat] Processing transcript:', text);
    setState(prev => ({ ...prev, isRecording: false, isListening: false }));

    try {
      const context = getContext?.() || [];
      const chatHistory = getChatHistory?.() || [];
      const systemPrompt = getSystemPrompt?.();

      // Get AI response from RAG pipeline
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          context,
          history: chatHistory,
          systemPrompt,
        }),
      });

      if (!chatResponse.ok) {
        throw new Error('Failed to get AI response');
      }

      const chatData = await chatResponse.json();
      if (!chatData.success) {
        throw new Error(chatData.error || 'Chat failed');
      }

      const aiResponse = chatData.data.answer;
      const confidence = chatData.data.confidence ?? 0.9;

      // Notify parent component
      onTranscript?.(text, aiResponse);

      // Synthesize and play via Inworld TTS
      if (isActiveRef.current && inworldRef.current && playbackRef.current) {
        console.log('[VoiceChat] Synthesizing with Inworld TTS...');

        const responseContext: ResponseContext = {
          confidence,
          isGreeting: /^(hi|hello|hey|good morning|good afternoon)/i.test(text),
          hasWarning: confidence < 0.85,
          isError: false,
          isPrivilegeFiltered: false,
        };

        // Prepare emotion-tagged text
        const preparedText = inworldRef.current.prepareTextForTTS(aiResponse, responseContext);

        setState(prev => ({ ...prev, isSpeaking: true }));

        try {
          const audioData = await inworldRef.current.synthesize({ text: preparedText });

          if (isActiveRef.current) {
            await playbackRef.current.play(
              audioData,
              () => {
                setState(prev => ({ ...prev, isSpeaking: false }));
              }
            );
          }
        } catch (ttsError) {
          console.warn('[VoiceChat] Inworld TTS failed, falling back to Google TTS:', ttsError);
          // Fallback to Google TTS if Inworld fails
          try {
            const fallbackResponse = await fetch('/api/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: aiResponse, voice: state.voice, speakingRate: 1.1 }),
            });

            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              if (fallbackData.audio && isActiveRef.current) {
                const audio = new Audio(`data:audio/mp3;base64,${fallbackData.audio}`);
                audio.onended = () => setState(prev => ({ ...prev, isSpeaking: false }));
                audio.onerror = () => setState(prev => ({ ...prev, isSpeaking: false }));
                await audio.play();
              }
            } else {
              setState(prev => ({ ...prev, isSpeaking: false }));
            }
          } catch {
            setState(prev => ({ ...prev, isSpeaking: false }));
          }
        }
      }

      // Ready for next recording
      setState(prev => ({ ...prev, transcript: '' }));
      accumulatedTranscriptRef.current = '';

    } catch (error) {
      console.error('[VoiceChat] Error:', error);
      setState(prev => ({
        ...prev,
        isSpeaking: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      }));
    }
  }, [onTranscript, getContext, getChatHistory, getSystemPrompt, state.voice]);

  // Stop recording and process transcript
  const stopRecording = useCallback(() => {
    clearSilenceTimer();
    isRecordingRef.current = false;

    // Stop mic capture
    captureRef.current?.stop();

    // Disconnect Deepgram
    deepgramRef.current?.disconnect();
    deepgramRef.current = null;

    const finalTranscript = accumulatedTranscriptRef.current.trim();
    if (finalTranscript) {
      processTranscript(finalTranscript);
    } else {
      setState(prev => ({ ...prev, isRecording: false, isListening: false, transcript: '' }));
    }
  }, [clearSilenceTimer, processTranscript]);

  // Start recording with Deepgram
  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;

    clearSilenceTimer();
    accumulatedTranscriptRef.current = '';
    isRecordingRef.current = true;

    setState(prev => ({ ...prev, isRecording: true, transcript: '', error: null }));

    try {
      // Create Deepgram client with callbacks
      const deepgram = new DeepgramClient({
        onTranscriptInterim: (text) => {
          // Reset silence timer on interim results
          clearSilenceTimer();
          const display = accumulatedTranscriptRef.current + text;
          setState(prev => ({ ...prev, transcript: display }));
        },
        onTranscriptFinal: (text) => {
          clearSilenceTimer();
          accumulatedTranscriptRef.current += text + ' ';
          setState(prev => ({ ...prev, transcript: accumulatedTranscriptRef.current.trim() }));

          // Start silence timer
          if (isRecordingRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              console.log('[VoiceChat] Silence detected (2s) - auto-stopping');
              stopRecording();
            }, SILENCE_TIMEOUT_MS);
          }
        },
        onUtteranceEnd: () => {
          // Deepgram detected end of utterance (1.5s silence)
          // Start our own timer as a backup
          if (isRecordingRef.current && accumulatedTranscriptRef.current.trim()) {
            clearSilenceTimer();
            silenceTimerRef.current = setTimeout(() => {
              console.log('[VoiceChat] Utterance end + silence - auto-stopping');
              stopRecording();
            }, SILENCE_TIMEOUT_MS);
          }
        },
        onConnectionChange: (connState) => {
          console.log('[VoiceChat] Deepgram connection:', connState);
          if (connState === 'error') {
            setState(prev => ({ ...prev, error: 'Voice connection error' }));
          }
        },
        onError: (error) => {
          console.error('[VoiceChat] Deepgram error:', error);
          setState(prev => ({ ...prev, error: error.message }));
        },
      });

      deepgramRef.current = deepgram;

      // Connect to Deepgram WebSocket
      await deepgram.connect();

      // Start audio capture, piping chunks to Deepgram
      const capture = new AudioCapture();
      captureRef.current = capture;

      await capture.start(
        (audioData) => deepgram.sendAudio(audioData)
      );

      setState(prev => ({ ...prev, isListening: true }));
      console.log('[VoiceChat] Recording started with Deepgram STT');

    } catch (error) {
      console.error('[VoiceChat] Start recording error:', error);
      isRecordingRef.current = false;
      setState(prev => ({
        ...prev,
        isRecording: false,
        isListening: false,
        error: error instanceof Error ? error.message : 'Failed to start recording',
      }));
    }
  }, [clearSilenceTimer, stopRecording]);

  // Toggle recording (manual control)
  const toggleRecording = useCallback(() => {
    if (isRecordingRef.current) {
      console.log('[VoiceChat] Manual STOP');
      stopRecording();
    } else if (!state.isSpeaking) {
      console.log('[VoiceChat] Manual START');
      startRecording();
    }
  }, [state.isSpeaking, startRecording, stopRecording]);

  // Start voice chat session
  const startVoiceChat = useCallback(async () => {
    try {
      // Request microphone permission
      const capture = new AudioCapture();
      const permission = await capture.requestPermission();

      if (permission === 'denied') {
        setState(prev => ({
          ...prev,
          error: 'Microphone access denied.',
          isConnected: false,
        }));
        return;
      }

      isActiveRef.current = true;

      setState(prev => ({
        ...prev,
        isConnected: true,
        isListening: false,
        isRecording: false,
        error: null,
        transcript: '',
      }));

      // Welcome message via Inworld TTS
      if (inworldRef.current && playbackRef.current) {
        try {
          setState(prev => ({ ...prev, isSpeaking: true }));
          const welcomeText = inworldRef.current.prepareTextForTTS(
            'Voice mode active. Click the microphone to speak.',
            { confidence: 1.0, isGreeting: true }
          );
          const audioData = await inworldRef.current.synthesize({ text: welcomeText });
          await playbackRef.current.play(
            audioData,
            () => setState(prev => ({ ...prev, isSpeaking: false }))
          );
        } catch (e) {
          console.warn('[VoiceChat] Welcome TTS failed:', e);
          setState(prev => ({ ...prev, isSpeaking: false }));
        }
      }

    } catch (error) {
      console.error('[VoiceChat] Error starting:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start voice chat',
        isConnected: false,
      }));
    }
  }, []);

  // Stop voice chat session completely
  const stopVoiceChat = useCallback(() => {
    isActiveRef.current = false;
    isRecordingRef.current = false;
    clearSilenceTimer();

    captureRef.current?.stop();
    captureRef.current = null;

    deepgramRef.current?.disconnect();
    deepgramRef.current = null;

    playbackRef.current?.stop();

    accumulatedTranscriptRef.current = '';

    setState({
      isConnected: false,
      isListening: false,
      isRecording: false,
      isSpeaking: false,
      transcript: '',
      error: null,
      voice: state.voice,
    });
  }, [state.voice, clearSilenceTimer]);

  // Interrupt current speech
  const interrupt = useCallback(() => {
    playbackRef.current?.stop();
    setState(prev => ({ ...prev, isSpeaking: false }));
  }, []);

  // Set voice
  const setVoice = useCallback((voice: TTSVoice) => {
    setState(prev => ({ ...prev, voice }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      isRecordingRef.current = false;
      clearSilenceTimer();
      captureRef.current?.stop();
      deepgramRef.current?.disconnect();
      playbackRef.current?.dispose();
    };
  }, [clearSilenceTimer]);

  return {
    ...state,
    startVoiceChat,
    stopVoiceChat,
    toggleRecording,
    interrupt,
    setVoice,
  };
}

// Re-export voice type for components
export type { TTSVoice as GeminiVoice };
