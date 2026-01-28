/**
 * sanitizeForTTS - Strip markdown and formatting artifacts from text
 * before sending to text-to-speech synthesis.
 *
 * Removes: bold/italic markers, headers, citation brackets, code blocks,
 * bullet points, links, HTML tags, excessive whitespace.
 */

export function sanitizeForTTS(text: string): string {
  let out = text;

  // Remove code blocks (``` ... ```)
  out = out.replace(/```[\s\S]*?```/g, ' code block omitted ');

  // Remove inline code (`...`)
  out = out.replace(/`([^`]+)`/g, '$1');

  // Remove markdown headers (## Header)
  out = out.replace(/^#{1,6}\s+/gm, '');

  // Remove bold/italic markers
  out = out.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
  out = out.replace(/\*\*(.+?)\*\*/g, '$1');
  out = out.replace(/\*(.+?)\*/g, '$1');
  out = out.replace(/___(.+?)___/g, '$1');
  out = out.replace(/__(.+?)__/g, '$1');
  out = out.replace(/_(.+?)_/g, '$1');

  // Remove citation brackets [1], [2], [1][2], etc.
  out = out.replace(/\[\d+\]/g, '');

  // Remove markdown links [text](url) -> text
  out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove markdown images ![alt](url)
  out = out.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // Remove HTML tags
  out = out.replace(/<[^>]+>/g, '');

  // Convert bullet points to natural pauses
  out = out.replace(/^\s*[-*+]\s+/gm, '');
  out = out.replace(/^\s*\d+\.\s+/gm, '');

  // Remove horizontal rules
  out = out.replace(/^[-*_]{3,}\s*$/gm, '');

  // Remove blockquote markers
  out = out.replace(/^\s*>\s?/gm, '');

  // Collapse multiple newlines into sentence breaks
  out = out.replace(/\n{2,}/g, '. ');
  out = out.replace(/\n/g, ' ');

  // Collapse multiple spaces
  out = out.replace(/\s{2,}/g, ' ');

  // Clean up artifacts like ". ." or ",."
  out = out.replace(/\.\s*\./g, '.');
  out = out.replace(/,\s*\./g, '.');

  return out.trim();
}
