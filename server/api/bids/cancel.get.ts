import { eq } from 'drizzle-orm'
import { useDb } from '../../database/index'
import { bids } from '../../database/schema'
import { parseBidId } from '../../utils/bid-id'
import { failBid } from '../../utils/fulfill-bid'
import { isCheckoutAbandoned, isCheckoutPaid } from '../../utils/polar-checkout'
import { usePolar } from '../../utils/polar'
import { rateLimitByIp } from '../../utils/rate-limit'

/**
 * Marks a pending bid failed when checkout was cancelled or abandoned.
 * Refunds on Polar when a paid order exists but the bid is rejected.
 */
export default defineEventHandler(async (event) => {
  rateLimitByIp(event, { limit: 30, windowMs: 60_000 })

  const bidId = parseBidId(getQuery(event).bid_id)
  const db = useDb()

  const [bid] = await db
    .select({
      id: bids.id,
      status: bids.status,
      amount: bids.amount,
      gameId: bids.gameId,
      polarCheckoutId: bids.polarCheckoutId
    })
    .from(bids)
    .where(eq(bids.id, bidId))
    .limit(1)

  if (!bid) {
    throw createError({ statusCode: 404, statusMessage: 'Bid not found' })
  }

  if (bid.status === 'paid' || bid.status === 'failed') {
    return {
      status: bid.status,
      amount: bid.amount,
      gameId: bid.gameId,
      source: 'database'
    }
  }

  if (bid.status !== 'pending') {
    return {
      status: bid.status,
      amount: bid.amount,
      gameId: bid.gameId,
      source: 'database'
    }
  }

  if (bid.polarCheckoutId) {
    try {
      const polar = usePolar()
      const checkout = await polar.checkouts.get({ id: bid.polarCheckoutId })

      if (isCheckoutPaid(checkout.status)) {
        return {
          status: bid.status,
          amount: bid.amount,
          gameId: bid.gameId,
          source: 'polar_checkout',
          checkoutStatus: checkout.status
        }
      }

      if (!isCheckoutAbandoned(checkout.status)) {
        // User backed out while checkout is still open — fail locally; Polar expires the session.
      }
    } catch {
      // Best effort: still fail the bid below.
    }
  }

  const result = await failBid(bidId)

  return {
    status: result.failed ? 'failed' : bid.status,
    amount: bid.amount,
    gameId: bid.gameId,
    source: result.failed ? 'cancelled' : 'database',
    reason: result.reason,
    polar: result.polar
  }
})
