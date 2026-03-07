/**
 * EPIC-028 TTFB Benchmark — measures time-to-first-token for SSE chat queries.
 * Usage: node scripts/ttfb-benchmark.mjs
 */

const BACKEND = 'https://ragbox-backend-100739220279.us-east4.run.app';
const AUTH = 'ARldjoNIYQv1UaX3Tf4PKgdnVsL8w2aAb9ci9dx6nuE=';
const USER_ID = '112599334142731255371';

const QUERIES = [
  { id: 'Q1', query: 'What is the agreement number for the Meridian Healthcare contract?', target: 'MSA' },
  { id: 'Q2', query: "What was ConnexUS AI's ARR at the end of Q4 2025?", target: 'Q4 Financial' },
  { id: 'Q6', query: 'What are the three subscription tiers and their monthly prices?', target: 'Q4 Financial' },
  { id: 'Q11', query: 'The MSA mentions SOC 2 Type II. What does the vendor risk assessment say about timeline and cost?', target: 'Cross-doc' },
  { id: 'Q16', query: 'Based on all available documents what are the top 3 security risks?', target: 'Cross-doc' },
];

async function runQuery(q) {
  const startMs = Date.now();
  let ttfbMs = 0;
  let totalMs = 0;
  let tokenCount = 0;
  let confidence = 0;
  let citationCount = 0;
  let answer = '';
  let error = null;

  try {
    const res = await fetch(`${BACKEND}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': AUTH,
        'X-User-ID': USER_ID,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ query: q.query, stream: true }),
    });

    if (!res.ok) {
      error = `HTTP ${res.status}`;
      return { ...q, ttfbMs: 0, totalMs: Date.now() - startMs, tokenCount: 0, confidence: 0, citationCount: 0, answer: '', error };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
          continue;
        }
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (currentEvent === 'token') {
            if (ttfbMs === 0) {
              ttfbMs = Date.now() - startMs;
            }
            tokenCount++;
            try {
              const parsed = JSON.parse(data);
              answer += parsed.text || '';
            } catch {}
          } else if (currentEvent === 'confidence') {
            try {
              const parsed = JSON.parse(data);
              confidence = parsed.score || parsed.confidence || 0;
            } catch {}
          } else if (currentEvent === 'citations') {
            try {
              const parsed = JSON.parse(data);
              citationCount = Array.isArray(parsed) ? parsed.length : 0;
            } catch {}
          } else if (currentEvent === 'done') {
            totalMs = Date.now() - startMs;
            try {
              const parsed = JSON.parse(data);
              if (parsed.cached) {
                // For cached responses, check if ttfbMs was set
                if (ttfbMs === 0) ttfbMs = totalMs;
              }
              if (parsed.evidence) {
                confidence = confidence || parsed.evidence.confidenceScore || 0;
                citationCount = citationCount || parsed.evidence.citationCount || 0;
              }
              if (parsed.citations) {
                citationCount = citationCount || parsed.citations.length || 0;
              }
            } catch {}
          } else if (currentEvent === 'error') {
            try {
              const parsed = JSON.parse(data);
              error = parsed.message || parsed.error || data;
            } catch {
              error = data;
            }
          }
        }
      }
    }
  } catch (e) {
    error = e.message;
  }

  if (totalMs === 0) totalMs = Date.now() - startMs;

  return { ...q, ttfbMs, totalMs, tokenCount, confidence, citationCount, answer: answer.slice(0, 120), error };
}

async function runBenchmark(label) {
  console.log(`\n=== ${label} ===\n`);
  const results = [];

  for (const q of QUERIES) {
    process.stdout.write(`  ${q.id}: ${q.query.slice(0, 50)}... `);
    const result = await runQuery(q);
    console.log(`TTFB=${result.ttfbMs}ms Total=${result.totalMs}ms Conf=${result.confidence.toFixed(2)} Cit=${result.citationCount} Tok=${result.tokenCount}${result.error ? ' ERR=' + result.error : ''}`);
    results.push(result);

    // Small delay between queries to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

async function main() {
  console.log('EPIC-028 TTFB Benchmark — Deploy 48');
  console.log(`Backend: ${BACKEND}`);
  console.log(`User: ${USER_ID}`);
  console.log(`Date: ${new Date().toISOString()}`);

  // Run 1: Cold cache
  const cold = await runBenchmark('RUN 1 — Cold Cache (first run, no Redis cache)');

  // Small delay to let any async cache writes complete
  await new Promise(r => setTimeout(r, 2000));

  // Run 2: Warm cache (same queries — should hit Redis)
  const warm = await runBenchmark('RUN 2 — Warm Cache (second run, Redis should be populated)');

  // Output JSON for processing
  const output = { cold, warm, timestamp: new Date().toISOString() };
  console.log('\n=== JSON OUTPUT ===');
  console.log(JSON.stringify(output, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
