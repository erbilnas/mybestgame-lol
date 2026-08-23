import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { useDb } from '../../database/index'
import { bids, games } from '../../database/schema'
import {
  getFreshLeaderboardTotals,
  projectRank,
  validateIncrementCents
} from '../../utils/bidding'
import { checkoutMetadata } from '../../utils/checkout-product'
import { parseOptionalDirectorFields } from '../../utils/director-fields'
import { failBid } from '../../utils/fulfill-bid'
import { fetchGameDetails } from '../../utils/igdb'
import { usePolar } from '../../utils/polar'
import { rateLimitByIp } from '../../utils/rate-limit'
import { getTrustedClientIp } from '../../utils/request-ip'
import { sanitizeDisplayName } from '../../utils/sanitize'
import { verifyTurnstile } from '../../utils/turnstile'

interface CreateCheckoutBody {
  bidType?: string
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

  if (body.bidType === 'sponsor') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Separate contribution types are no longer available. Use support with an optional Game Director Message.'
    })
  }

  const gameId = Number(body.gameId)
  const incrementCents = Math.round(Number(body.amount) * 100)

  if (!Number.isInteger(gameId) || gameId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid game' })
  }

  const displayName = sanitizeDisplayName(body.displayName)
  validateIncrementCents(incrementCents)

  const director = parseOptionalDirectorFields(body)

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

  validateIncrementCents(incrementCents)
  const totals = await getFreshLeaderboardTotals()
  projectRank(totals, gameId, incrementCents)

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
    bidType: 'game',
    gameId,
    displayName,
    amount: incrementCents,
    adTitle: director.adTitle,
    adLink: director.adLink,
    adImage: director.adImage,
    adDescription: director.adDescription,
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
      metadata: checkoutMetadata(title, {
        bidId,
        bidType: 'game',
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
