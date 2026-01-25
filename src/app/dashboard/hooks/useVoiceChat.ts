'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// Google Cloud TTS voices (Neural2 - most natural)
export type TTSVoice = 'aria' | 'luke' | 'nova' | 'echo' | 'sage';

export interface VoiceChatState {
  isConnected: boolean;
  isListening: boolean;
  isRecording: boolean;  // New: tracks active recording state
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
  voice: TTSVoice;
}

export interface UseVoiceChatReturn extends VoiceChatState {
  startVoiceChat: () => Promise<void>;
  stopVoiceChat: () => void;
  toggleRecording: () => void;  // New: manual toggle for recording
  interrupt: () => void;
  setVoice: (voice: TTSVoice) => void;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface VoiceChatOptions {
  getContext?: () => string[];  // Function to get current document context
  getChatHistory?: () => ChatHistoryMessage[];  // Function to get chat history for context
  getSystemPrompt?: () => string;  // Function to get current protocol system prompt
}

// Check if Speech Recognition is available
const getSpeechRecognition = (): typeof SpeechRecognition | null => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition || null;
};

// Silence detection timeout (2 seconds)
const SILENCE_TIMEOUT_MS = 2000;

/**
 * Voice chat hook using Web Speech API (STT) + Google Cloud TTS
 *
 * NEW: Manual Toggle Mode
 * - Click mic to START recording
 * - Click mic again to STOP recording (or wait 2s silence)
 * - No more premature cutoffs mid-sentence
 *
 * Flow:
 * 1. User clicks mic -> Recording starts (continuous mode)
 * 2. User speaks -> Transcript accumulates
 * 3. User clicks stop OR 2s silence -> Recording stops
 * 4. Full transcript sent to /api/chat WITH context + history + system prompt
 * 5. Response played via TTS
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

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isActiveRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTranscriptRef = useRef('');
  const isRecordingRef = useRef(false);

  // Clear silence timer
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Play audio from base64 MP3
  const playAudio = useCallback((base64Audio: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        audioRef.current = audio;

        audio.onplay = () => {
          setState(prev => ({ ...prev, isSpeaking: true }));
        };

        audio.onended = () => {
          setState(prev => ({ ...prev, isSpeaking: false }));
          audioRef.current = null;
          resolve();
        };

        audio.onerror = () => {
          setState(prev => ({ ...prev, isSpeaking: false }));
          audioRef.current = null;
          reject(new Error('Audio playback failed'));
        };

        audio.play().catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  // Convert text to speech using Google Cloud TTS
  const textToSpeech = useCallback(async (text: string): Promise<string> => {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: state.voice,
        speakingRate: 1.1,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'TTS failed');
    }

    const data = await response.json();
    return data.audio;
  }, [state.voice]);

  // Process the accumulated transcript
  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim()) return;

    console.log('[VoiceChat] Processing full transcript:', text);
    setState(prev => ({ ...prev, isRecording: false, isListening: false }));

    try {
      // Get document context (same as text chat uses)
      const context = getContext?.() || [];
      const chatHistory = getChatHistory?.() || [];
      const systemPrompt = getSystemPrompt?.();

      console.log(`[VoiceChat] Context: ${context.length} docs, History: ${chatHistory.length} turns, Protocol: ${systemPrompt ? 'yes' : 'no'}`);

      // Get AI response from Gemini WITH full context
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          context: context,
          history: chatHistory,
          systemPrompt: systemPrompt,
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

      // Notify parent component
      onTranscript?.(text, aiResponse);

      // Convert response to speech
      if (isActiveRef.current) {
        console.log('[VoiceChat] Converting to speech...');
        const audioBase64 = await textToSpeech(aiResponse);

        if (isActiveRef.current) {
          await playAudio(audioBase64);
        }
      }

      // Ready for next recording (but don't auto-start)
      setState(prev => ({ ...prev, transcript: '' }));
      accumulatedTranscriptRef.current = '';

    } catch (error) {
      console.error('[VoiceChat] Error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Processing failed',
      }));
    }
  }, [onTranscript, textToSpeech, playAudio, getContext, getChatHistory, getSystemPrompt]);

  // Stop recording and process
  const stopRecording = useCallback(() => {
    clearSilenceTimer();
    isRecordingRef.current = false;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const finalTranscript = accumulatedTranscriptRef.current.trim();
    if (finalTranscript) {
      processTranscript(finalTranscript);
    } else {
      setState(prev => ({ ...prev, isRecording: false, isListening: false, transcript: '' }));
    }
  }, [clearSilenceTimer, processTranscript]);

  // Start recording
  const startRecording = useCallback(() => {
    if (!recognitionRef.current || isRecordingRef.current) return;

    clearSilenceTimer();
    accumulatedTranscriptRef.current = '';
    isRecordingRef.current = true;

    setState(prev => ({ ...prev, isRecording: true, transcript: '', error: null }));

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn('[VoiceChat] Recognition start failed:', e);
    }
  }, [clearSilenceTimer]);

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
    const SpeechRecognitionAPI = getSpeechRecognition();

    if (!SpeechRecognitionAPI) {
      setState(prev => ({
        ...prev,
        error: 'Speech recognition not supported. Try Chrome.',
      }));
      return;
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      isActiveRef.current = true;

      // Set up speech recognition with CONTINUOUS mode
      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;

      recognition.continuous = true;  // KEY: Keep listening until manual stop
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        console.log('[VoiceChat] Recording started...');
        setState(prev => ({ ...prev, isListening: true, isRecording: true, error: null }));
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Reset silence timer on any speech
        clearSilenceTimer();

        let interimTranscript = '';
        let sessionTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            sessionTranscript += result[0].transcript + ' ';
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        // Update accumulated transcript
        accumulatedTranscriptRef.current = sessionTranscript.trim();

        // Show current state to user
        const displayTranscript = (sessionTranscript + interimTranscript).trim();
        setState(prev => ({ ...prev, transcript: displayTranscript }));

        // Start silence timer (2 seconds of no speech = auto-stop)
        if (isRecordingRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            console.log('[VoiceChat] Silence detected (2s) - auto-stopping');
            stopRecording();
          }, SILENCE_TIMEOUT_MS);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('[VoiceChat] Recognition error:', event.error);

        if (event.error === 'not-allowed') {
          setState(prev => ({
            ...prev,
            error: 'Microphone access denied.',
            isListening: false,
            isRecording: false,
            isConnected: false,
          }));
          isActiveRef.current = false;
        } else if (event.error === 'no-speech') {
          // No speech detected - just wait, don't error
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch (e) {
              // Ignore
            }
          }
        } else if (event.error !== 'aborted') {
          setState(prev => ({
            ...prev,
            error: `Recognition error: ${event.error}`,
          }));
        }
      };

      recognition.onend = () => {
        console.log('[VoiceChat] Recognition ended');
        setState(prev => ({ ...prev, isListening: false }));

        // If still recording (not manual stop), restart
        if (isRecordingRef.current && isActiveRef.current && !state.isSpeaking) {
          try {
            recognition.start();
          } catch (e) {
            // Ignore
          }
        }
      };

      setState(prev => ({
        ...prev,
        isConnected: true,
        isListening: false,
        isRecording: false,
        error: null,
        transcript: '',
      }));

      // Welcome message via TTS
      try {
        const welcomeAudio = await textToSpeech('Voice mode active. Click the microphone to speak.');
        await playAudio(welcomeAudio);
      } catch (e) {
        console.warn('[VoiceChat] Welcome message failed:', e);
      }

    } catch (error) {
      console.error('[VoiceChat] Error starting:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start voice chat',
        isConnected: false,
      }));
    }
  }, [state.isSpeaking, textToSpeech, playAudio, clearSilenceTimer, stopRecording]);

  // Stop voice chat session completely
  const stopVoiceChat = useCallback(() => {
    isActiveRef.current = false;
    isRecordingRef.current = false;
    clearSilenceTimer();

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState(prev => ({ ...prev, isSpeaking: false }));
  }, []);

  // Set voice (called from settings)
  const setVoice = useCallback((voice: TTSVoice) => {
    setState(prev => ({ ...prev, voice }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      isRecordingRef.current = false;
      clearSilenceTimer();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
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
