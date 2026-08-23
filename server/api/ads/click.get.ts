import { parseBidId } from '../../utils/bid-id'
import { incrementAdClick } from '../../utils/bidding'
import { rateLimitByIp } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  rateLimitByIp(event, { limit: 60, windowMs: 60_000 })

  const bidId = parseBidId(getQuery(event).bidId, 'bidId')
  const destination = await incrementAdClick(bidId)

  if (!destination) {
    throw createError({ statusCode: 404, statusMessage: 'Ad not found' })
  }

  return sendRedirect(event, destination, 302)
})
