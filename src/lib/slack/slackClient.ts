/**
 * Slack Web API Client — EPIC-024
 *
 * Minimal wrapper for Slack chat.postMessage and reactions.add.
 * Uses bot token from SLACK_BOT_TOKEN env var.
 */

import { logger } from '@/lib/logger'

const SLACK_API = 'https://slack.com/api'

function getToken(): string {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) throw new Error('SLACK_BOT_TOKEN not configured')
  return token
}

async function slackApi(method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as { ok: boolean; error?: string; ts?: string }
  if (!data.ok) {
    logger.error(`[Slack] API error in ${method}:`, data.error)
  }
  return data
}

/**
 * Post a message to a Slack channel.
 * If thread_ts is provided, replies in the thread.
 */
export async function postMessage(
  channel: string,
  text: string,
  threadTs?: string,
): Promise<{ ok: boolean; ts?: string }> {
  const body: Record<string, unknown> = { channel, text }
  if (threadTs) body.thread_ts = threadTs

  // Convert citation [1], [2] to Slack mrkdwn bold
  body.text = (body.text as string).replace(/\[(\d+)\]/g, '*[$1]*')

  const result = await slackApi('chat.postMessage', body)
  return { ok: !!result.ok, ts: result.ts as string | undefined }
}

/**
 * Add a reaction (emoji) to a message.
 */
export async function addReaction(
  channel: string,
  timestamp: string,
  emoji: string,
): Promise<void> {
  await slackApi('reactions.add', { channel, timestamp, name: emoji })
}
