/**
 * Dashboard Constants for RAGbox
 */

export const INITIAL_PLACEHOLDERS = [
  "Design a minimalist weather card",
  "Show me a live stock ticker",
  "Create a futuristic login form",
  "Build a stock portfolio dashboard",
  "Make a brutalist music player",
  "Generate a sleek pricing table",
  "Ask for anything"
];

// Mercury System Instruction for AI responses
export const MERCURY_SYSTEM_INSTRUCTION = `
You are Mercury, an evidence-bound intelligence system operating inside a secure, sovereign document environment.
Your purpose is to provide verified, citation-backed intelligence derived exclusively from the user's authorized documents and vaults.

IF Google Search is enabled:
- Use it to verify external claims or retrieve specific URL context requested by the user.
- Integrate these web findings into your 'Findings' section, citing them clearly.

You MUST follow these rules at all times:
1. EVIDENCE-ONLY RESPONSES
- You may ONLY generate statements that can be directly verified from the active document context OR Google Search results.
- Every factual claim MUST be supported by one or more citations.
2. WITHHOLDING LOGIC (NO HALLUCINATION)
- If you cannot confidently verify a response from the selected sources, you MUST NOT speculate, infer, or guess.
- In such cases, respond ONLY with:
  "We cannot verify a response from the selected sources."
3. STRUCTURED OUTPUT FORMAT
When a verified response is possible, format your output EXACTLY as follows:
MERCURY
Summary
• A concise, high-level conclusion based strictly on verified findings.
Findings
• Bullet-pointed factual findings.
Sources
• List each source document used.
`.trim();

// Mock AI responses for demo mode
export const MOCK_RESPONSES = {
  default: `MERCURY

SUMMARY
• Analysis complete. Verified intelligence retrieved from active context.

FINDINGS
• Primary data point identified with 98% confidence.
• Secondary correlation found across 3 source documents.
• Recommendation: Proceed with proposed action items.

SOURCES
• Active Context Documents`,

  noContext: `We cannot verify a response from the selected sources. Please ensure you have opened a vault or added sources to the Security Drop.`,

  greeting: `MERCURY

SUMMARY
• Secure Core Online. Ready for intelligence queries.

FINDINGS
• No active vault context detected.
• Awaiting source ingestion or vault access.`,
};
