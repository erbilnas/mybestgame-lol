import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { useDb } from '../../database/index'
import { bids, deviceFreeClaims, games } from '../../database/schema'
import {
  FREE_SUPPORT_CENTS,
  getFreshLeaderboardTotals,
  projectRank
} from '../../utils/bidding'
import { ensureDeviceId, getClientIp, hasClaimedFreeSupport } from '../../utils/device'
import { fulfillBid } from '../../utils/fulfill-bid'
import { fetchGameDetails } from '../../utils/igdb'
import { rateLimitByIp } from '../../utils/rate-limit'
import { sanitizeDisplayName } from '../../utils/sanitize'
import { verifyTurnstile } from '../../utils/turnstile'

interface ClaimFreeBody {
  gameId: number
  title: string
  slug: string
  coverUrl?: string | null
  displayName?: string
  turnstileToken: string
}

const ALREADY_CLAIMED = 'Free support already claimed on this device or network'

export default defineEventHandler(async (event) => {
  rateLimitByIp(event, { limit: 5, windowMs: 60_000 })

  const body = await readBody<ClaimFreeBody>(event)
  const ip = getClientIp(event)

  if (!ip) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Could not verify network for free support'
    })
  }

  await verifyTurnstile(body.turnstileToken, ip)

  const deviceId = ensureDeviceId(event)

  if (await hasClaimedFreeSupport(deviceId, ip)) {
    throw createError({
      statusCode: 403,
      statusMessage: ALREADY_CLAIMED
    })
  }

  const gameId = Number(body.gameId)
  if (!Number.isInteger(gameId) || gameId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid game' })
  }

  const title = (body.title ?? '').trim()
  const slug = (body.slug ?? '').trim()
  if (!title || !slug) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid game' })
  }

  const displayName = sanitizeDisplayName(body.displayName)
  const bidId = randomUUID()
  const incrementCents = FREE_SUPPORT_CENTS

  const totals = await getFreshLeaderboardTotals()
  projectRank(totals, gameId, incrementCents)

  let gameSummary: string | null
  try {
    const igdbGame = await fetchGameDetails(gameId, slug)
    gameSummary = igdbGame?.summary ?? null
  } catch {
    gameSummary = null
  }

  const db = useDb()

  // Reserve device + IP slots (unique on both). Concurrent claims lose here.
  try {
    await db.insert(deviceFreeClaims).values({
      deviceId,
      ip,
      bidId,
      claimedAt: new Date()
    })
  } catch {
    throw createError({
      statusCode: 403,
      statusMessage: ALREADY_CLAIMED
    })
  }

  try {
    await db.insert(games).values({
      id: gameId,
      title,
      slug,
      coverUrl: body.coverUrl ?? null,
      summary: gameSummary
    }).onConflictDoUpdate({
      target: games.id,
      set: {
        title,
        slug,
        coverUrl: body.coverUrl ?? null,
        ...(gameSummary ? { summary: gameSummary } : {})
      }
    })

    const freeOrderId = `free:${bidId}`

    await db.insert(bids).values({
      id: bidId,
      bidType: 'game',
      gameId,
      displayName,
      amount: incrementCents,
      adTitle: '',
      adLink: '',
      adImage: null,
      adDescription: null,
      status: 'pending',
      polarOrderId: freeOrderId
    })

    const result = await fulfillBid(bidId, {
      polarOrderId: freeOrderId,
      paidAmountCents: incrementCents
    })
    if (!result.fulfilled) {
      throw new Error(result.reason)
    }
  } catch {
    await db.delete(deviceFreeClaims).where(eq(deviceFreeClaims.deviceId, deviceId))
    await db.update(bids).set({ status: 'failed' }).where(eq(bids.id, bidId))
    throw createError({
      statusCode: 500,
      statusMessage: 'Could not apply free support'
    })
  }

  return {
    bidId,
    amountCents: incrementCents
  }
})
