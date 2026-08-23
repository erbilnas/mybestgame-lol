import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { useDb } from '../../database/index'
import { bids, games, type BidType } from '../../database/schema'
import {
  getFreshLeaderboardTotals,
  getMinSponsorBidCents,
  parseBidType,
  projectRank,
  validateIncrementCents,
  validateSponsorBidCents
} from '../../utils/bidding'
import { checkoutMetadata } from '../../utils/checkout-product'
import { failBid } from '../../utils/fulfill-bid'
import { fetchGameDetails } from '../../utils/igdb'
import { usePolar } from '../../utils/polar'
import { rateLimitByIp } from '../../utils/rate-limit'
import { getTrustedClientIp } from '../../utils/request-ip'
import {
  sanitizeAdDescription,
  sanitizeAdImage,
  sanitizeAdLink,
  sanitizeAdTitle,
  sanitizeDisplayName
} from '../../utils/sanitize'
import { verifyTurnstile } from '../../utils/turnstile'

interface CreateCheckoutBody {
  bidType?: BidType
  gameId: number
  title: string
  slug: string
  coverUrl?: string | null
  amount: number
  displayName?: string
  adTitle?: string
  adLink?: string
  adImage?: string
  adDescription?: string
  turnstileToken: string
  locale?: 'en' | 'tr'
}

export default defineEventHandler(async (event) => {
  rateLimitByIp(event, { limit: 10, windowMs: 60_000 })

  const body = await readBody<CreateCheckoutBody>(event)
  const ip = getTrustedClientIp(event) ?? undefined

  await verifyTurnstile(body.turnstileToken, ip)

  const bidType = parseBidType(body.bidType ?? 'game')
  const gameId = Number(body.gameId)
  const incrementCents = Math.round(Number(body.amount) * 100)

  if (!Number.isInteger(gameId) || gameId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid game' })
  }

  const displayName = sanitizeDisplayName(body.displayName)

  // Fast fail before locking the DB / calling IGDB.
  if (bidType === 'game') {
    validateIncrementCents(incrementCents)
  } else {
    const minSponsorBidCents = await getMinSponsorBidCents(gameId)
    validateSponsorBidCents(incrementCents, minSponsorBidCents)
  }

  let adTitle = ''
  let adLink = ''
  let adImage: string | null = null
  let adDescription: string | null = null

  if (bidType === 'sponsor') {
    adTitle = sanitizeAdTitle(body.adTitle ?? '')
    adLink = sanitizeAdLink(body.adLink ?? '')
    adImage = sanitizeAdImage(body.adImage)
    adDescription = sanitizeAdDescription(body.adDescription)

    if (!adTitle) {
      throw createError({ statusCode: 400, statusMessage: 'Sponsor title is required for premium card customization' })
    }
    if (!adDescription) {
      throw createError({ statusCode: 400, statusMessage: 'Sponsor description is required for premium card customization' })
    }
  }

  const db = useDb()
  const config = useRuntimeConfig()

  if (!config.polarProductId) {
    throw createError({ statusCode: 503, statusMessage: 'Polar product not configured' })
  }

  const title = body.title.trim()
  const slug = body.slug.trim()
  if (!title || !slug) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid game' })
  }

  let gameSummary: string | null
  try {
    const igdbGame = await fetchGameDetails(gameId, slug)
    gameSummary = igdbGame?.summary ?? null
  } catch {
    gameSummary = null
  }

  const bidId = randomUUID()

  // Re-validate with fresh board state immediately before insert.
  if (bidType === 'game') {
    validateIncrementCents(incrementCents)
    const totals = await getFreshLeaderboardTotals()
    projectRank(totals, gameId, incrementCents)
  } else {
    const minSponsorBidCents = await getMinSponsorBidCents(gameId)
    validateSponsorBidCents(incrementCents, minSponsorBidCents)
  }

  const stalePending = await db
    .select({ id: bids.id })
    .from(bids)
    .where(and(
      eq(bids.gameId, gameId),
      eq(bids.displayName, displayName),
      eq(bids.status, 'pending')
    ))

  for (const staleBid of stalePending) {
    await failBid(staleBid.id)
  }

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

  await db.insert(bids).values({
    id: bidId,
    bidType,
    gameId,
    displayName,
    amount: incrementCents,
    adTitle,
    adLink,
    adImage,
    adDescription,
    status: 'pending'
  })

  const polar = usePolar()
  const successUrl = `${config.public.siteUrl}/success?bid_id=${bidId}`
  const returnUrl = `${config.public.siteUrl}/?checkout=cancelled&bid_id=${bidId}`
  const polarLocale = body.locale === 'tr' ? 'tr' : 'en'

  try {
    const checkout = await polar.checkouts.create({
      products: [config.polarProductId],
      prices: {
        [config.polarProductId]: [{
          amountType: 'fixed',
          priceAmount: incrementCents,
          priceCurrency: 'usd'
        }]
      },
      locale: polarLocale,
      metadata: checkoutMetadata(bidType, title, {
        bidId,
        bidType,
        gameId: String(gameId),
        incrementCents: String(incrementCents)
      }),
      successUrl,
      returnUrl
    })

    await db
      .update(bids)
      .set({ polarCheckoutId: checkout.id })
      .where(eq(bids.id, bidId))

    return {
      checkoutUrl: checkout.url,
      bidId
    }
  } catch (error) {
    await failBid(bidId)
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({ statusCode: 502, statusMessage: 'Could not create checkout' })
  }
})
