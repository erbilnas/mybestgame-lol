import { parseBidId } from '../../utils/bid-id'
import { getPaidBidPlaque } from '../../utils/bidding'
import { rateLimitByIp } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  rateLimitByIp(event, { limit: 60, windowMs: 60_000 })

  const bidId = parseBidId(getQuery(event).bid_id)

  const plaque = await getPaidBidPlaque(bidId)
  if (!plaque) {
    throw createError({ statusCode: 404, statusMessage: 'Contribution not found' })
  }

  return {
    id: plaque.id,
    status: plaque.status,
    amount: plaque.amount,
    gameId: plaque.gameId,
    bidType: plaque.bidType,
    gameTitle: plaque.gameTitle,
    slug: plaque.slug,
    coverUrl: plaque.coverUrl,
    rank: plaque.rank,
    totalCents: plaque.totalCents,
    expiresAt: plaque.expiresAt,
    createdAt: plaque.createdAt,
    contributor: plaque.contributor,
    hasDirectorMessage: plaque.hasDirectorMessage,
    directorTitle: plaque.directorTitle
  }
})
