import Redis from 'ioredis'
import { logger } from '@/lib/logger'

let redis: Redis | null = null

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null
        return Math.min(times * 200, 2000)
      },
      lazyConnect: true,
      connectTimeout: 5000,
    })
    redis.on('error', (err) => {
      logger.error('[Redis] Connection error:', err.message)
    })
  }
  return redis
}
