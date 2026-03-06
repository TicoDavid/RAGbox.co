import { AudioChunkInterface } from '@inworld/runtime/common';

export enum EVENT_TYPE {
  TEXT = 'text',
  AUDIO = 'audio',
  AUDIO_SESSION_END = 'audioSessionEnd',
}

export interface TextInput {
  key: string;
  text: string;
  interactionId: string;
  userId?: string;
}

export interface AudioInput {
  key: string;
  audio: AudioChunkInterface;
  state: {
    agent: { id: string; name: string; description: string; motivation: string };
    userName: string;
    messages: Array<{ id: string; role: string; content: string }>;
    imageUrl: string;
  };
  interactionId: string;
}

export interface MercurySession {
  userId: string;
  personaId?: string;
  voiceId?: string;
  threadId?: string;
  temperature?: number;
  speakingRate?: number;
}

export interface VoiceGraphOpts {
  voiceId?: string;
  temperature?: number;
  speakingRate?: number;
}
