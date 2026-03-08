/**
 * greeting.ts — Time-aware greeting builder for Mercury voice sessions.
 *
 * Phase 3: Time-aware greeting generation.
 * Phase 4: Proactive insight injection into greeting.
 *
 * Greeting must be SHORT — TTS latency is critical (<1.5s to first audio).
 * Greeting + insight MUST stay under 3 sentences total.
 */

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || 'http://localhost:8080';
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || '';

export interface GreetingContext {
  userName?: string;
  userId?: string;
  recentTopics?: string[];
}

interface Insight {
  id: string;
  title: string;
  summary: string;
  insightType: string;
}

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'latenight';

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'latenight';
}

const BASE_GREETINGS: Record<TimeOfDay, string[]> = {
  morning: [
    'Good morning{name}. Ready to dive in?',
    'Morning{name}. What can I pull up for you?',
  ],
  afternoon: [
    'Good afternoon{name}. What are we working on?',
    'Afternoon{name}. How can I help?',
  ],
  evening: [
    'Good evening{name}. What can I help you with tonight?',
    'Evening{name}. What do you need?',
  ],
  latenight: [
    'Burning the midnight oil{name}? What can I find for you?',
    'Still at it{name}? Let me know what you need.',
  ],
};

const CONTEXTUAL_GREETINGS: Record<TimeOfDay, string[]> = {
  morning: [
    "Good morning{name}. I've been looking through your vault — shall I catch you up?",
  ],
  afternoon: [
    "Good afternoon{name}. I noticed some updates in your documents — want a quick summary?",
  ],
  evening: [
    "Good evening{name}. Picking up where we left off?",
  ],
  latenight: [
    "Late session{name}? I've got your vault ready whenever you are.",
  ],
};

/**
 * Build a time-aware greeting for a voice session.
 * If userId is provided, fetches the top proactive insight and appends it.
 * Greeting + insight stays under 3 sentences total.
 */
export async function buildGreeting(ctx: GreetingContext): Promise<string> {
  const hour = new Date().getHours();
  const timeOfDay = getTimeOfDay(hour);
  const nameSuffix = ctx.userName ? `, ${ctx.userName}` : '';

  const hasContext = ctx.recentTopics && ctx.recentTopics.length > 0;
  const pool = hasContext
    ? CONTEXTUAL_GREETINGS[timeOfDay]
    : BASE_GREETINGS[timeOfDay];

  const template = pool[Math.floor(Math.random() * pool.length)];
  const baseGreeting = template.replace('{name}', nameSuffix);

  // Phase 4: Fetch top insight (non-blocking — fall back to base greeting on failure)
  if (ctx.userId) {
    const insight = await fetchTopInsight(ctx.userId);
    if (insight) {
      // Insight sentence counts toward 3-sentence cap.
      // Base greeting is 1-2 sentences, insight adds 1.
      return `${baseGreeting} ${formatInsightSentence(insight)}`;
    }
  }

  return baseGreeting;
}

/**
 * Fetch the top active insight for a user from the Go backend.
 * Returns null on any failure (non-fatal).
 */
async function fetchTopInsight(userId: string): Promise<Insight | null> {
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/v1/insights?limit=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
        'X-User-ID': userId,
      },
      signal: AbortSignal.timeout(2000), // 2s max — don't block greeting
    });

    if (!res.ok) return null;

    const body = await res.json() as { success: boolean; data?: Insight[] };
    if (!body.success || !body.data || body.data.length === 0) return null;

    return body.data[0];
  } catch {
    // Non-fatal: insight fetch failure should never block the greeting
    return null;
  }
}

/**
 * Format an insight into a single natural sentence for voice.
 */
function formatInsightSentence(insight: Insight): string {
  // Use the title directly — it's already short (under 60 chars)
  switch (insight.insightType) {
    case 'deadline':
      return `By the way, I flagged something — ${insight.title.toLowerCase()}.`;
    case 'expiring':
      return `I noticed something in your vault — ${insight.title.toLowerCase()}.`;
    case 'anomaly':
      return `Something caught my attention — ${insight.title.toLowerCase()}.`;
    default:
      return `Just a heads up — ${insight.title.toLowerCase()}.`;
  }
}

/**
 * Fire-and-forget: trigger a background vault scan.
 * Results populate the insights table for NEXT session's greeting.
 */
export function triggerBackgroundScan(userId: string): void {
  fetch(`${GO_BACKEND_URL}/api/v1/insights/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Auth': INTERNAL_AUTH_SECRET,
      'X-User-ID': userId,
    },
    body: JSON.stringify({ tenantId: 'default' }),
    signal: AbortSignal.timeout(60_000),
  }).catch((err) => {
    console.error('[InsightScan] Background scan failed (non-fatal):', err);
  });
}
