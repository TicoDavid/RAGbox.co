// src/mercury/outputFirewall.test.ts
import { sanitizeMercuryOutput } from './outputFirewall';

describe('outputFirewall', () => {
  test('removes trained-by leakage', () => {
    const input = 'I am a large language model, trained by Google. How can I help?';
    const res = sanitizeMercuryOutput(input);
    expect(res.triggered).toBe(true);
    expect(res.sanitized).toContain("I'm Mercury");
    expect(res.sanitized).not.toMatch(/trained by Google/i);
  });

  test('removes "as an AI language model"', () => {
    const input = 'As an AI language model, I can\'t do that.';
    const res = sanitizeMercuryOutput(input);
    expect(res.triggered).toBe(true);
    expect(res.sanitized).not.toMatch(/as an ai language model/i);
  });

  test('replaces "I am Gemini" with Mercury identity', () => {
    const input = 'I am Gemini, a helpful assistant.';
    const res = sanitizeMercuryOutput(input);
    expect(res.triggered).toBe(true);
    expect(res.sanitized).toContain("I'm Mercury");
    expect(res.sanitized).not.toMatch(/Gemini/i);
  });

  test('replaces "I\'m ChatGPT" with Mercury identity', () => {
    const input = "I'm ChatGPT and I can help you.";
    const res = sanitizeMercuryOutput(input);
    expect(res.triggered).toBe(true);
    expect(res.sanitized).toContain("I'm Mercury");
    expect(res.sanitized).not.toMatch(/ChatGPT/i);
  });

  test('replaces OpenAI brand with RAGbox', () => {
    const input = 'This feature was developed by OpenAI.';
    const res = sanitizeMercuryOutput(input);
    expect(res.triggered).toBe(true);
    expect(res.sanitized).not.toMatch(/OpenAI/i);
  });

  test('replaces Anthropic/Claude with RAGbox/Mercury', () => {
    const input = 'I am Claude, made by Anthropic.';
    const res = sanitizeMercuryOutput(input);
    expect(res.triggered).toBe(true);
    expect(res.sanitized).not.toMatch(/Claude/);
    expect(res.sanitized).not.toMatch(/Anthropic/);
  });

  test('replaces "powered by Google" in self-reference', () => {
    const input = 'This system is powered by Google AI.';
    const res = sanitizeMercuryOutput(input);
    expect(res.triggered).toBe(true);
    expect(res.sanitized).toContain('private RAGbox model route');
  });

  test('does not modify clean text', () => {
    const input = 'Here are the findings with citations: [1] [2].';
    const res = sanitizeMercuryOutput(input);
    expect(res.triggered).toBe(false);
    expect(res.sanitized).toBe(input);
  });

  test('does not false-positive on "google" in document content', () => {
    const input = 'The contract references Google Cloud storage pricing on page 4.';
    const res = sanitizeMercuryOutput(input);
    // "google" appears but not in identity context (no "I am google", "made by google")
    expect(res.triggered).toBe(false);
    expect(res.sanitized).toBe(input);
  });

  test('does not false-positive on general technical text', () => {
    const input = 'The defendant filed a motion to compel discovery on January 15.';
    const res = sanitizeMercuryOutput(input);
    expect(res.triggered).toBe(false);
    expect(res.sanitized).toBe(input);
  });

  test('handles multiple violations in one response', () => {
    const input = 'I am Gemini, trained by Google. OpenAI also makes models.';
    const res = sanitizeMercuryOutput(input);
    expect(res.triggered).toBe(true);
    expect(res.reasons.length).toBeGreaterThanOrEqual(2);
    expect(res.sanitized).not.toMatch(/Gemini/i);
    expect(res.sanitized).not.toMatch(/OpenAI/i);
  });

  test('returns reasons array with pattern names', () => {
    const input = 'As an AI language model, I was trained by OpenAI.';
    const res = sanitizeMercuryOutput(input);
    expect(res.reasons).toContain('as_an_ai_language_model');
    expect(res.reasons).toContain('openai_brand');
  });
});
