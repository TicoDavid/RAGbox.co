// src/mercury/outputFirewall.ts

export type FirewallResult = {
  sanitized: string;
  triggered: boolean;
  reasons: string[];
};

const BANNED_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'vendor_trained_by', re: /\btrained by (google|openai|anthropic|meta|microsoft)\b/i },
  { name: 'i_am_vendor_model', re: /\b(i am|i'm)\s+(gemini|chatgpt|gpt-?4|gpt-?5|claude|bard)\b/i },
  { name: 'as_an_ai_language_model', re: /\bas an ai language model\b/i },
  { name: 'openai_brand', re: /\bopenai\b/i },
  { name: 'google_brand_identity', re: /\b(i am|i'm|made by|created by|built by|developed by|powered by)\s+google\b/i },
  { name: 'anthropic_brand', re: /\banthropic\b/i },
  { name: 'claude_brand', re: /\bclaude\b/i },
];

const SAFE_REPLACEMENT = `I'm Mercury\u2014RAGbox's secure retrieval assistant.`;

function detectReasons(text: string): string[] {
  const reasons: string[] = [];
  for (const p of BANNED_PATTERNS) {
    if (p.re.test(text)) reasons.push(p.name);
  }
  return reasons;
}

export function sanitizeMercuryOutput(text: string): FirewallResult {
  const reasons = detectReasons(text);
  if (reasons.length === 0) return { sanitized: text, triggered: false, reasons: [] };

  let out = text;

  // 1) Replace classic identity lines
  out = out.replace(
    /\bI am a large language model[, ]*trained by [^.!\n]+[.!\n]*/gi,
    `${SAFE_REPLACEMENT}\n`
  );
  out = out.replace(/\bAs an AI language model[, ]*/gi, '');

  // 2) Replace "I'm Gemini/ChatGPT/Claude/etc."
  out = out.replace(/\b(I am|I'm)\s+(Gemini|ChatGPT|Claude|Bard|GPT-?4|GPT-?5)\b/gi, SAFE_REPLACEMENT);

  // 3) Remove stray vendor mentions in self-reference context
  out = out.replace(
    /\b(trained by|powered by|made by|created by|built by|developed by)\s+(Google|OpenAI|Anthropic|Meta|Microsoft)\b/gi,
    'using a private RAGbox model route'
  );

  // 4) Strip remaining brand names in identity context
  out = out.replace(/\b(I am|I'm)\s+google\b/gi, SAFE_REPLACEMENT);
  out = out.replace(/\bOpenAI\b/gi, 'RAGbox');
  out = out.replace(/\bAnthropic\b/gi, 'RAGbox');
  out = out.replace(/\bClaude\b/gi, 'Mercury');

  // 5) If after all replacements the output still starts with a banned phrase, force clean opener
  const trimmed = out.trimStart();
  if (detectReasons(trimmed.slice(0, 200)).length > 0) {
    out = `${SAFE_REPLACEMENT}\n\n${out}`;
  }

  return { sanitized: out, triggered: true, reasons };
}

/**
 * Sanitize a streaming chunk. Buffers are handled by the caller;
 * this function operates on whatever text segment is provided.
 */
export function sanitizeChunk(chunk: string): string {
  return sanitizeMercuryOutput(chunk).sanitized;
}

/**
 * Optional rewrite pass (default OFF). Call only when belt+suspenders is needed.
 */
export async function optionalRewritePass(args: {
  text: string;
  rewriteCall: (instruction: string) => Promise<string>;
}): Promise<string> {
  const first = sanitizeMercuryOutput(args.text);
  if (!first.triggered) return args.text;

  const instruction = `
Rewrite the following assistant message to remove ANY vendor/model identity leakage.
Rules:
- Keep meaning and structure.
- Do NOT mention Google/OpenAI/Anthropic/Gemini/ChatGPT/Claude.
- If identity is referenced, use: "I'm Mercury—RAGbox's secure retrieval assistant."
- Do not add new facts.

MESSAGE:
${first.sanitized}
`.trim();

  const rewritten = await args.rewriteCall(instruction);
  return sanitizeMercuryOutput(rewritten).sanitized;
}
