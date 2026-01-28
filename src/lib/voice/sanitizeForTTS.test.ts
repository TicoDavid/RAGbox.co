import { sanitizeForTTS } from './sanitizeForTTS';

describe('sanitizeForTTS', () => {
  it('removes bold markers', () => {
    expect(sanitizeForTTS('This is **bold** text')).toBe('This is bold text');
  });

  it('removes italic markers', () => {
    expect(sanitizeForTTS('This is *italic* text')).toBe('This is italic text');
  });

  it('removes bold+italic markers', () => {
    expect(sanitizeForTTS('This is ***important*** text')).toBe('This is important text');
  });

  it('removes markdown headers', () => {
    expect(sanitizeForTTS('## Summary\nHere is the summary')).toBe('Summary Here is the summary');
  });

  it('removes citation brackets', () => {
    expect(sanitizeForTTS('The court ruled [1] that evidence [2] was valid.')).toBe(
      'The court ruled that evidence was valid.'
    );
  });

  it('removes inline code', () => {
    expect(sanitizeForTTS('Use the `fetch` function')).toBe('Use the fetch function');
  });

  it('replaces code blocks with spoken label', () => {
    const input = 'Here is code:\n```javascript\nconsole.log("hello")\n```\nDone.';
    expect(sanitizeForTTS(input)).toBe('Here is code: code block omitted Done.');
  });

  it('converts markdown links to plain text', () => {
    expect(sanitizeForTTS('See [this document](https://example.com) for details')).toBe(
      'See this document for details'
    );
  });

  it('removes bullet points', () => {
    const input = '- First item\n- Second item\n* Third item';
    const result = sanitizeForTTS(input);
    expect(result).toBe('First item Second item Third item');
  });

  it('removes numbered lists', () => {
    const input = '1. First\n2. Second\n3. Third';
    const result = sanitizeForTTS(input);
    expect(result).toBe('First Second Third');
  });

  it('removes HTML tags', () => {
    expect(sanitizeForTTS('Hello <b>world</b> and <a href="#">link</a>')).toBe(
      'Hello world and link'
    );
  });

  it('collapses excessive whitespace', () => {
    expect(sanitizeForTTS('Hello    world\n\n\nNew paragraph')).toBe('Hello world. New paragraph');
  });

  it('passes clean text unchanged', () => {
    const clean = 'The document states that compliance is required for all transactions.';
    expect(sanitizeForTTS(clean)).toBe(clean);
  });

  it('handles combined markdown formatting', () => {
    const input = '## Analysis\n\n**Key findings** [1]:\n- The contract *requires* disclosure\n- See [Section 4](https://docs.com/s4) for details\n\nConfidence is high.';
    const result = sanitizeForTTS(input);
    expect(result).toBe('Analysis. Key findings : The contract requires disclosure See Section 4 for details. Confidence is high.');
  });

  it('removes blockquote markers', () => {
    expect(sanitizeForTTS('> This is a quote\n> from a document')).toBe(
      'This is a quote from a document'
    );
  });
});
