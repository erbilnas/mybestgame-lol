import { createHmac, timingSafeEqual } from 'node:crypto'

/** HMAC-sign a cookie value. Format: `value.signature` (base64url). */
export function signCookieValue(value: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(value).digest('base64url')
  return `${value}.${sig}`
}

/** Verify a signed cookie. Returns the raw value or null. */
export function verifyCookieValue(signed: string, secret: string): string | null {
  const i = signed.lastIndexOf('.')
  if (i <= 0) return null

  const value = signed.slice(0, i)
  const sig = signed.slice(i + 1)
  if (!value || !sig) return null

  const expected = createHmac('sha256', secret).update(value).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length) return null
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null

  return value
}
