/**
 * Mercury Voice Interface - Type Definitions
 *
 * TypeScript types for the Deepgram STT + Inworld TTS voice stack.
 */

// Connection states for Deepgram WebSocket
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

// Voice mode states
export type VoiceState =
  | 'idle'           // Voice mode off
  | 'listening'      // User speaking
  | 'processing'     // Transcribing/thinking
  | 'speaking'       // Mercury responding
  | 'error';         // Error state

// Microphone permission states
export type MicPermission =
  | 'prompt'         // Not yet requested
  | 'granted'        // User allowed
  | 'denied';        // User blocked

// Deepgram transcript result
export interface TranscriptResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

// Deepgram WebSocket message
export interface DeepgramMessage {
  type: 'Results' | 'UtteranceEnd' | 'Metadata' | 'Error';
  channel_index?: [number, number];
  is_final?: boolean;
  channel?: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
      }>;
    }>;
  };
}

// TTS synthesis request
export interface TTSRequest {
  text: string;
  voiceId?: string;
  emotion?: 'warm' | 'confident' | 'thoughtful' | 'serious' | 'concerned' | 'apologetic' | 'neutral';
}

// Voice configuration
export interface VoiceConfig {
  sampleRate?: number;
  silenceThreshold?: number;
  maxRecordingMs?: number;
  confidenceThreshold?: number;
  autoSubmit?: boolean;
}

// Callbacks for voice events
export interface VoiceCallbacks {
  onTranscriptInterim?: (text: string) => void;
  onTranscriptFinal?: (text: string, confidence: number) => void;
  onUtteranceEnd?: () => void;
  onStateChange?: (state: VoiceState) => void;
  onConnectionChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
  onAudioLevel?: (level: number) => void;
}

// Context for emotion mapping in TTS
export interface ResponseContext {
  isGreeting?: boolean;
  confidence: number;
  hasWarning?: boolean;
  isPrivilegeFiltered?: boolean;
  isError?: boolean;
}
