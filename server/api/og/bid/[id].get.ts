import { parseBidId } from '../../../utils/bid-id'
import { getPaidBidPlaque } from '../../../utils/bidding'
import { renderBidPlaqueSvg } from '../../../utils/embed-badge'
import { rateLimitByIp } from '../../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  rateLimitByIp(event, { limit: 60, windowMs: 60_000 })

  const bidId = parseBidId(
    String(getRouterParam(event, 'id') ?? '').replace(/\.svg$/i, '').trim()
  )

  const plaque = await getPaidBidPlaque(bidId)
  if (!plaque || plaque.status !== 'paid') {
    throw createError({ statusCode: 404, statusMessage: 'Plaque not found' })
  }

  setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=60')

  return renderBidPlaqueSvg({
    title: plaque.gameTitle,
    rank: plaque.rank,
    amountCents: plaque.amount,
    contributor: plaque.contributor
  })
})
