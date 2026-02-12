'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { DeepgramClient } from '@/lib/voice/deepgram-client';
import { AudioCapture } from '@/lib/voice/audio-capture';
import { AudioPlayback } from '@/lib/voice/audio-playback';
import { InworldClient } from '@/lib/voice/inworld-client';
import { sanitizeForTTS } from '@/lib/voice/sanitizeForTTS';
import type { ResponseContext } from '@/lib/voice/types';

// Voice type kept for API compatibility
export type TTSVoice = 'aria' | 'luke' | 'nova' | 'echo' | 'sage';

export type VoiceMode = 'off' | 'on' | 'mute';

export interface VoiceChatState {
  mode: VoiceMode;
  isSpeaking: boolean;
  isProcessing: boolean;
  transcript: string;
  error: string | null;
  voice: TTSVoice;
}

export interface UseVoiceChatReturn extends VoiceChatState {
  turnOn: () => Promise<void>;
  turnOff: () => void;
  toggleMute: () => void;
  interrupt: () => void;
  setVoice: (voice: TTSVoice) => void;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PageContext {
  activePanel: string;
  activeDocument: string | null;
  documentCount: number;
  searchQuery: string;
}

export interface VoiceChatOptions {
  getContext?: () => string[];
  getChatHistory?: () => ChatHistoryMessage[];
  getSystemPrompt?: () => string;
  getPageContext?: () => PageContext;
}

// Silence detection timeout (2 seconds after last speech)
const SILENCE_TIMEOUT_MS = 2000;

const WELCOME_MESSAGE = "Hi! I'm Mercury, your document assistant. I can help you search your files, answer questions, or walk you through anything on screen. Just ask!";

/**
 * Voice chat hook — Three-state continuous-listening model
 *
 * States:
 *   OFF  — Disconnected, dark button with blue border
 *   ON   — Continuous listening via Deepgram, green button
 *   MUTE — Connected but mic paused, amber button
 *
 * Click: OFF->ON, ON->MUTE, MUTE->ON (or interrupt if speaking)
 * Long-press (600ms): ON->OFF, MUTE->OFF
 *
 * Flow (ON mode):
 *   Deepgram WebSocket stays open. User speaks -> silence detected (2s)
 *   -> transcript sent to /api/chat -> TTS plays response
 *   -> mic auto-resumes listening. No manual clicks between utterances.
 */
export function useVoiceChat(
  onTranscript?: (userText: string, aiResponse: string) => void,
  options?: VoiceChatOptions
): UseVoiceChatReturn {
  const { getContext, getChatHistory, getSystemPrompt, getPageContext } = options || {};

  const [state, setState] = useState<VoiceChatState>({
    mode: 'off',
    isSpeaking: false,
    isProcessing: false,
    transcript: '',
    error: null,
    voice: 'aria',
  });

  // Refs to prevent stale closures in async callbacks
  const modeRef = useRef<VoiceMode>('off');
  const deepgramRef = useRef<DeepgramClient | null>(null);
  const captureRef = useRef<AudioCapture | null>(null);
  const playbackRef = useRef<AudioPlayback | null>(null);
  const inworldRef = useRef<InworldClient | null>(null);
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

  const setMode = useCallback((mode: VoiceMode) => {
    modeRef.current = mode;
    setState(prev => ({ ...prev, mode }));
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // --- Audio capture helpers ---

  const stopCapture = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
  }, []);

  const startCapture = useCallback(async () => {
    if (!deepgramRef.current) return;

    const deepgram = deepgramRef.current;
    const capture = new AudioCapture();
    captureRef.current = capture;

    await capture.start((audioData) => {
      deepgram.sendAudio(audioData);
    });

  }, []);

  // --- Process transcript and auto-resume ---

  const processAndResume = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // 1. Pause AudioCapture (prevent feedback loop)
    stopCapture();
    clearSilenceTimer();
    accumulatedTranscriptRef.current = '';

    setState(prev => ({ ...prev, isProcessing: true, transcript: '' }));

    try {
      const context = getContext?.() || [];
      const chatHistory = getChatHistory?.() || [];
      const systemPrompt = getSystemPrompt?.();
      const pageContext = getPageContext?.();

      // Build page-aware system prompt
      let fullSystemPrompt = systemPrompt || '';
      if (pageContext) {
        const pageInfo = [
          `User is viewing the ${pageContext.activePanel} panel.`,
          pageContext.activeDocument ? `Active document: "${pageContext.activeDocument}".` : null,
          pageContext.documentCount > 0 ? `${pageContext.documentCount} document(s) loaded.` : 'No documents loaded.',
          pageContext.searchQuery ? `Current search: "${pageContext.searchQuery}".` : null,
        ].filter(Boolean).join(' ');
        fullSystemPrompt = fullSystemPrompt
          ? `${fullSystemPrompt}\n\nPage context: ${pageInfo}`
          : `Page context: ${pageInfo}`;
      }

      // 2. Send transcript to /api/chat
      const chatResponse = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          context,
          history: chatHistory,
          systemPrompt: fullSystemPrompt || undefined,
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

      setState(prev => ({ ...prev, isProcessing: false }));

      // 3. Synthesize + play TTS response
      if (modeRef.current !== 'off' && inworldRef.current && playbackRef.current) {
        const responseContext: ResponseContext = {
          confidence,
          isGreeting: /^(hi|hello|hey|good morning|good afternoon)/i.test(text),
          hasWarning: confidence < 0.85,
          isError: false,
          isPrivilegeFiltered: false,
        };

        const spokenText = sanitizeForTTS(aiResponse);
        const preparedText = inworldRef.current.prepareTextForTTS(spokenText, responseContext);

        setState(prev => ({ ...prev, isSpeaking: true }));

        try {
          const audioData = await inworldRef.current.synthesize({ text: preparedText });

          const currentMode = modeRef.current as VoiceMode;
          if (currentMode !== 'off') {
            await playbackRef.current.play(audioData, () => {
              setState(prev => ({ ...prev, isSpeaking: false }));

              // 4. Auto-restart AudioCapture if still in ON mode
              if (modeRef.current === 'on') {
                startCapture().catch(() => {
                });
              }
            });
          } else {
            setState(prev => ({ ...prev, isSpeaking: false }));
          }
        } catch (ttsError) {
          try {
            const fallbackResponse = await apiFetch('/api/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: spokenText, voice: state.voice, speakingRate: 1.1 }),
            });

            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              const fallbackMode = modeRef.current as VoiceMode;
              if (fallbackData.audio && fallbackMode !== 'off') {
                const audio = new Audio(`data:audio/mp3;base64,${fallbackData.audio}`);
                audio.onended = () => {
                  setState(prev => ({ ...prev, isSpeaking: false }));
                  if (modeRef.current === 'on') {
                    startCapture().catch(() => {
                    });
                  }
                };
                audio.onerror = () => {
                  setState(prev => ({ ...prev, isSpeaking: false }));
                  if (modeRef.current === 'on') {
                    startCapture().catch(() => {
                    });
                  }
                };
                await audio.play();
              } else {
                setState(prev => ({ ...prev, isSpeaking: false }));
                if (modeRef.current === 'on') {
                  await startCapture();
                }
              }
            } else {
              setState(prev => ({ ...prev, isSpeaking: false }));
              if (modeRef.current === 'on') {
                await startCapture();
              }
            }
          } catch {
            setState(prev => ({ ...prev, isSpeaking: false }));
            if (modeRef.current === 'on') {
              await startCapture();
            }
          }
        }
      } else {
        setState(prev => ({ ...prev, isProcessing: false }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSpeaking: false,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      }));

      // Try to resume listening even after error
      if (modeRef.current === 'on') {
        try {
          await startCapture();
        } catch (err) {
          // ignored
        }
      }
    }
  }, [onTranscript, getContext, getChatHistory, getSystemPrompt, getPageContext, state.voice, stopCapture, startCapture, clearSilenceTimer]);

  // --- Connect Deepgram with transcript handlers ---

  const connectDeepgram = useCallback(async () => {
    const deepgram = new DeepgramClient({
      onTranscriptInterim: (text) => {
        clearSilenceTimer();
        const display = accumulatedTranscriptRef.current + text;
        setState(prev => ({ ...prev, transcript: display }));
      },
      onTranscriptFinal: (text) => {
        clearSilenceTimer();
        accumulatedTranscriptRef.current += text + ' ';
        setState(prev => ({ ...prev, transcript: accumulatedTranscriptRef.current.trim() }));

        // Start silence timer — after 2s silence, process the utterance
        if (modeRef.current === 'on') {
          silenceTimerRef.current = setTimeout(() => {
            const finalText = accumulatedTranscriptRef.current.trim();
            if (finalText) {
              processAndResume(finalText);
            }
          }, SILENCE_TIMEOUT_MS);
        }
      },
      onUtteranceEnd: () => {
        // Deepgram detected end of utterance (1.5s silence) — start our timer as backup
        if (modeRef.current === 'on' && accumulatedTranscriptRef.current.trim()) {
          clearSilenceTimer();
          silenceTimerRef.current = setTimeout(() => {
            const finalText = accumulatedTranscriptRef.current.trim();
            if (finalText) {
              processAndResume(finalText);
            }
          }, SILENCE_TIMEOUT_MS);
        }
      },
      onConnectionChange: (connState) => {
        if (connState === 'error') {
          setState(prev => ({ ...prev, error: 'Voice connection error' }));
        }
      },
      onError: (error) => {
        setState(prev => ({ ...prev, error: error.message }));
      },
    });

    deepgramRef.current = deepgram;
    await deepgram.connect();
  }, [clearSilenceTimer, processAndResume]);

  // --- Play welcome TTS ---

  const playWelcome = useCallback(async () => {
    if (!inworldRef.current || !playbackRef.current) return;

    try {
      setState(prev => ({ ...prev, isSpeaking: true }));

      const welcomeText = inworldRef.current.prepareTextForTTS(
        WELCOME_MESSAGE,
        { confidence: 1.0, isGreeting: true }
      );
      const audioData = await inworldRef.current.synthesize({ text: welcomeText });

      if (modeRef.current !== 'off') {
        await playbackRef.current.play(audioData, () => {
          setState(prev => ({ ...prev, isSpeaking: false }));

          // After welcome finishes, start listening if still ON
          if (modeRef.current === 'on') {
            startCapture().catch(() => {
            });
          }
        });
      } else {
        setState(prev => ({ ...prev, isSpeaking: false }));
      }
    } catch (e) {
      setState(prev => ({ ...prev, isSpeaking: false }));

      // Start listening anyway even if welcome TTS fails
      if (modeRef.current === 'on') {
        try {
          await startCapture();
        } catch (err) {
          // ignored
        }
      }
    }
  }, [startCapture]);

  // === Public API ===

  // OFF -> ON: request mic, connect Deepgram, play welcome, begin listening
  const turnOn = useCallback(async () => {
    try {
      // Request microphone permission
      const capture = new AudioCapture();
      const permission = await capture.requestPermission();

      if (permission === 'denied') {
        setState(prev => ({
          ...prev,
          error: 'Microphone access denied.',
        }));
        return;
      }

      setMode('on');
      setState(prev => ({
        ...prev,
        error: null,
        transcript: '',
        isProcessing: false,
      }));

      // Connect Deepgram WebSocket (stays open for the session)
      await connectDeepgram();

      // Play welcome and then auto-start listening
      playWelcome();

    } catch (error) {
      setMode('off');
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start voice chat',
      }));
    }
  }, [setMode, connectDeepgram, playWelcome]);

  // Any -> OFF: disconnect everything, reset state
  const turnOff = useCallback(() => {
    setMode('off');
    clearSilenceTimer();

    stopCapture();

    deepgramRef.current?.disconnect();
    deepgramRef.current = null;

    playbackRef.current?.stop();

    accumulatedTranscriptRef.current = '';

    setState(prev => ({
      mode: 'off',
      isSpeaking: false,
      isProcessing: false,
      transcript: '',
      error: null,
      voice: prev.voice,
    }));
  }, [setMode, clearSilenceTimer, stopCapture]);

  // ON -> MUTE: stop AudioCapture (keep Deepgram alive)
  // MUTE -> ON: restart AudioCapture
  const toggleMute = useCallback(() => {
    if (modeRef.current === 'on') {
      // ON -> MUTE
      setMode('mute');
      clearSilenceTimer();
      stopCapture();
      accumulatedTranscriptRef.current = '';
      setState(prev => ({ ...prev, transcript: '' }));
    } else if (modeRef.current === 'mute') {
      // MUTE -> ON
      setMode('on');
      accumulatedTranscriptRef.current = '';
      startCapture().catch(() => {
        setState(prev => ({ ...prev, error: 'Failed to resume microphone' }));
      });
    }
  }, [setMode, clearSilenceTimer, stopCapture, startCapture]);

  // Interrupt current speech
  const interrupt = useCallback(() => {
    playbackRef.current?.stop();
    setState(prev => ({ ...prev, isSpeaking: false }));

    // Resume listening after interruption if in ON mode
    if (modeRef.current === 'on') {
      startCapture().catch(() => {
      });
    }
  }, [startCapture]);

  // Set voice
  const setVoice = useCallback((voice: TTSVoice) => {
    setState(prev => ({ ...prev, voice }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      modeRef.current = 'off';
      clearSilenceTimer();
      captureRef.current?.stop();
      deepgramRef.current?.disconnect();
      playbackRef.current?.dispose();
    };
  }, [clearSilenceTimer]);

  return {
    ...state,
    turnOn,
    turnOff,
    toggleMute,
    interrupt,
    setVoice,
  };
}

// Re-export voice type for components
export type { TTSVoice as GeminiVoice };
