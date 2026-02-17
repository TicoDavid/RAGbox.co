import { describe, it, expect } from 'vitest';
import { EVENT_TYPE, AUDIO_SESSION_STATE } from './types';

describe('types', () => {
  describe('EVENT_TYPE', () => {
    it('defines all expected event types', () => {
      expect(EVENT_TYPE.TEXT).toBe('TEXT');
      expect(EVENT_TYPE.AUDIO).toBe('AUDIO');
      expect(EVENT_TYPE.AUDIO_SESSION_END).toBe('audioSessionEnd');
      expect(EVENT_TYPE.NEW_INTERACTION).toBe('newInteraction');
      expect(EVENT_TYPE.CANCEL_RESPONSE).toBe('CANCEL_RESPONSE');
      expect(EVENT_TYPE.USER_SPEECH_COMPLETE).toBe('USER_SPEECH_COMPLETE');
    });
  });

  describe('AUDIO_SESSION_STATE', () => {
    it('defines all expected session states', () => {
      expect(AUDIO_SESSION_STATE.PROCESSING).toBe('PROCESSING');
      expect(AUDIO_SESSION_STATE.ACTIVE).toBe('ACTIVE');
      expect(AUDIO_SESSION_STATE.INACTIVE).toBe('INACTIVE');
    });
  });
});
