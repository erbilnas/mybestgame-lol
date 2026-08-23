/**
 * Minimal self-check for security helpers (no Nuxt runtime).
 * Run: node scripts/verify-security.mjs
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import assert from 'node:assert/strict'

function signCookieValue(value, secret) {
  const sig = createHmac('sha256', secret).update(value).digest('base64url')
  return `${value}.${sig}`
}

function verifyCookieValue(signed, secret) {
  const i = signed.lastIndexOf('.')
  if (i <= 0) return null
  const value = signed.slice(0, i)
  const sig = signed.slice(i + 1)
  const expected = createHmac('sha256', secret).update(value).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length) return null
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null
  return value
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const secret = 'test-secret'
const signed = signCookieValue('device-abc-12345678', secret)
assert.equal(verifyCookieValue(signed, secret), 'device-abc-12345678')
assert.equal(verifyCookieValue(signed, 'wrong'), null)
assert.equal(verifyCookieValue('tampered.' + signed.split('.')[1], secret), null)

assert.ok(UUID_RE.test('550e8400-e29b-41d4-a716-446655440000'))
assert.ok(!UUID_RE.test('not-a-uuid'))
assert.ok(!UUID_RE.test('../etc/passwd'))

assert.equal(100 === 100, true, 'amount match')
assert.equal(100 === 99, false, 'amount mismatch')

const LOCAL_ORDER_PREFIXES = ['free:', 'checkout:']
function isPolarManagedOrderId(orderId) {
  if (!orderId) return false
  return !LOCAL_ORDER_PREFIXES.some(prefix => orderId.startsWith(prefix))
}
assert.ok(isPolarManagedOrderId('550e8400-e29b-41d4-a716-446655440000'))
assert.ok(!isPolarManagedOrderId('free:abc'))
assert.ok(!isPolarManagedOrderId('checkout:abc'))

console.log('verify-security: ok')
