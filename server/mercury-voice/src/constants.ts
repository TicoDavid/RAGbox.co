// Mercury Voice — Audio and graph constants
// Matches multimodal-companion-node patterns

export const DEFAULT_VOICE_ID = 'Ashley';
export const DEFAULT_TTS_MODEL_ID = 'inworld-tts-1.5-max';
export const DEFAULT_VAD_MODEL_PATH = '../assets/models/silero_vad.onnx';
export const INPUT_SAMPLE_RATE = 16000;
export const TTS_SAMPLE_RATE = 48000;
export const PAUSE_DURATION_THRESHOLD_MS = 800;
export const MIN_SPEECH_DURATION_MS = 300;
export const FRAME_PER_BUFFER = 1024;
export const SPEECH_THRESHOLD = 0.3;

export const TEXT_CONFIG = {
  max_new_tokens: 2500,
  max_prompt_length: 100,
  repetition_penalty: 1,
  top_p: 1,
  temperature: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  stop_sequences: [] as string[],
};
