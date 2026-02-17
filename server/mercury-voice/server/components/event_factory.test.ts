import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventFactory } from './event_factory';

describe('EventFactory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));
  });

  describe('text', () => {
    it('creates a TEXT event with agent source', () => {
      const event = EventFactory.text('Hello', 'int-1', { isAgent: true });

      expect(event.type).toBe('TEXT');
      expect(event.text).toEqual({ text: 'Hello', final: true });
      expect(event.packetId.interactionId).toBe('int-1');
      expect(event.packetId.utteranceId).toBeDefined();
      expect(event.routing.source).toEqual({ isAgent: true });
      expect(event.date).toBeInstanceOf(Date);
    });

    it('creates a TEXT event with user source', () => {
      const event = EventFactory.text('Hi', 'int-2', { isUser: true, name: 'Alice' });

      expect(event.routing.source).toEqual({ isUser: true, name: 'Alice' });
    });

    it('generates unique utterance IDs', () => {
      const e1 = EventFactory.text('A', 'int-1', { isAgent: true });
      const e2 = EventFactory.text('B', 'int-1', { isAgent: true });

      expect(e1.packetId.utteranceId).not.toBe(e2.packetId.utteranceId);
    });
  });

  describe('error', () => {
    it('creates an ERROR event', () => {
      const err = new Error('test failure');
      const event = EventFactory.error(err, 'int-3');

      expect(event.type).toBe('ERROR');
      expect(event.error).toContain('test failure');
      expect(event.packetId.interactionId).toBe('int-3');
    });
  });

  describe('interactionEnd', () => {
    it('creates an INTERACTION_END event', () => {
      const event = EventFactory.interactionEnd('int-4');

      expect(event.type).toBe('INTERACTION_END');
      expect(event.packetId.interactionId).toBe('int-4');
      expect(event.date).toBeInstanceOf(Date);
    });
  });

  describe('audio', () => {
    it('creates an AUDIO event with agent source', () => {
      const event = EventFactory.audio('base64data', 'int-5', 'utt-1');

      expect(event.type).toBe('AUDIO');
      expect(event.audio).toEqual({ chunk: 'base64data' });
      expect(event.packetId.interactionId).toBe('int-5');
      expect(event.packetId.utteranceId).toBe('utt-1');
      expect(event.routing.source).toEqual({ isAgent: true });
    });
  });

  describe('newInteraction', () => {
    it('creates a NEW_INTERACTION event', () => {
      const event = EventFactory.newInteraction('int-6');

      expect(event.type).toBe('NEW_INTERACTION');
      expect(event.packetId.interactionId).toBe('int-6');
    });
  });

  describe('cancelResponse', () => {
    it('creates a CANCEL_RESPONSE event', () => {
      const event = EventFactory.cancelResponse('int-7');

      expect(event.type).toBe('CANCEL_RESPONSE');
      expect(event.packetId.interactionId).toBe('int-7');
    });
  });

  describe('userSpeechComplete', () => {
    it('creates a USER_SPEECH_COMPLETE event', () => {
      const event = EventFactory.userSpeechComplete('int-8', { duration: 1500 });

      expect(event.type).toBe('USER_SPEECH_COMPLETE');
      expect(event.packetId.interactionId).toBe('int-8');
      expect(event.metadata).toEqual({ duration: 1500 });
    });

    it('works without metadata', () => {
      const event = EventFactory.userSpeechComplete('int-9');

      expect(event.type).toBe('USER_SPEECH_COMPLETE');
      expect(event.metadata).toBeUndefined();
    });
  });
});
