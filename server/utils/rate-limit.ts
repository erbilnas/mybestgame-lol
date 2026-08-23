import type { H3Event } from 'h3'
import { useSqlite } from '../database/index'
import { getTrustedClientIp } from './request-ip'

interface RateLimitOptions {
  limit: number
  windowMs: number
}

/**
 * SQLite-backed rate limiter so buckets survive restarts and work for a single
 * Node process (this app's deploy model). Multi-instance: swap for Redis.
 * ponytail: single-node SQLite ceiling; upgrade to Redis/Nitro shared storage
 * when running more than one Node process behind a load balancer.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): void {
  const now = Date.now()
  const sqlite = useSqlite()

  const row = sqlite
    .prepare('SELECT count, reset_at AS resetAt FROM rate_limit_buckets WHERE key = ?')
    .get(key) as { count: number, resetAt: number } | undefined

  if (!row || now >= row.resetAt) {
    sqlite
      .prepare(
        `INSERT INTO rate_limit_buckets (key, count, reset_at)
         VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at`
      )
      .run(key, now + options.windowMs)
    return
  }

  if (row.count >= options.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((row.resetAt - now) / 1000))
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
      data: { retryAfter: retryAfterSec }
    })
  }

  sqlite
    .prepare('UPDATE rate_limit_buckets SET count = count + 1 WHERE key = ?')
    .run(key)
}

export function rateLimitByIp(event: H3Event, options: RateLimitOptions): void {
  const ip = getTrustedClientIp(event) ?? 'unknown'
  try {
    checkRateLimit(`${event.path}:${ip}`, options)
  } catch (error) {
    if (
      error
      && typeof error === 'object'
      && 'statusCode' in error
      && (error as { statusCode: number }).statusCode === 429
      && 'data' in error
      && error.data
      && typeof error.data === 'object'
      && 'retryAfter' in error.data
    ) {
      setHeader(event, 'Retry-After', (error.data as { retryAfter: number }).retryAfter)
    }
    throw error
  }
}
