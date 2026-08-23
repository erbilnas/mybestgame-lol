import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { eq, or } from 'drizzle-orm'
import { useDb } from '../database/index'
import { deviceFreeClaims } from '../database/schema'
import { signCookieValue, verifyCookieValue } from './crypto-cookie'
import { getTrustedClientIp } from './request-ip'

export const DEVICE_COOKIE = 'mbg_device'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365
const RAW_DEVICE_ID_RE = /^[0-9a-f-]{16,64}$/i

function deviceCookieSecret(): string {
  const config = useRuntimeConfig()
  return (
    config.deviceCookieSecret
    || config.polarWebhookSecret
    || 'dev-only-device-cookie-secret'
  )
}

function readDeviceId(event: H3Event): string | null {
  const raw = getCookie(event, DEVICE_COOKIE)
  if (!raw) return null

  const secret = deviceCookieSecret()
  const verified = verifyCookieValue(raw, secret)
  if (verified && RAW_DEVICE_ID_RE.test(verified)) {
    return verified
  }

  // Legacy unsigned cookies: accept once, then re-issue signed.
  if (RAW_DEVICE_ID_RE.test(raw) && raw.length >= 16 && raw.length <= 64) {
    return raw
  }

  return null
}

export function ensureDeviceId(event: H3Event): string {
  const existing = readDeviceId(event)
  if (existing) {
    // Refresh signature so legacy cookies become signed.
    setCookie(event, DEVICE_COOKIE, signCookieValue(existing, deviceCookieSecret()), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ONE_YEAR_SECONDS
    })
    return existing
  }

  const deviceId = randomUUID()
  setCookie(event, DEVICE_COOKIE, signCookieValue(deviceId, deviceCookieSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR_SECONDS
  })
  return deviceId
}

export function getClientIp(event: H3Event): string | null {
  return getTrustedClientIp(event)
}

/** Dev: free $1 promo stays available (no device/IP lock). Prod: one claim forever. */
export function isUnlimitedFreeSupport(): boolean {
  return import.meta.dev || process.env.NODE_ENV !== 'production'
}

export async function hasClaimedFreeSupport(deviceId: string, ip: string): Promise<boolean> {
  if (isUnlimitedFreeSupport()) return false

  const db = useDb()
  const [row] = await db
    .select({ deviceId: deviceFreeClaims.deviceId })
    .from(deviceFreeClaims)
    .where(or(
      eq(deviceFreeClaims.deviceId, deviceId),
      eq(deviceFreeClaims.ip, ip)
    ))
    .limit(1)
  return Boolean(row)
}
