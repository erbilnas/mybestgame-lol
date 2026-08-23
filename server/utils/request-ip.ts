import type { H3Event } from 'h3'

/**
 * Resolve client IP with proxy awareness.
 * Prefer Cloudflare's CF-Connecting-IP when present.
 * Only trust X-Forwarded-For when NUXT_TRUST_PROXY=true (behind a known reverse proxy).
 */
export function getTrustedClientIp(event: H3Event): string | null {
  const cfIp = getHeader(event, 'cf-connecting-ip')?.trim()
  if (cfIp && cfIp !== 'unknown') {
    return cfIp
  }

  const config = useRuntimeConfig()
  const trustProxy = String(config.trustProxy).toLowerCase() === 'true'

  const ip = getRequestIP(event, { xForwardedFor: trustProxy })?.trim()
  if (!ip || ip === 'unknown') {
    return null
  }
  return ip
}
