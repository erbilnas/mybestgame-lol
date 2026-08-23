import { eq } from 'drizzle-orm'
import { useDb } from '../../database/index'
import { bids } from '../../database/schema'
import { parseBidId } from '../../utils/bid-id'
import { failBid, fulfillBid } from '../../utils/fulfill-bid'
import { isCheckoutAbandoned, isCheckoutPaid, paidAmountCentsFromPolar } from '../../utils/polar-checkout'
import { usePolar } from '../../utils/polar'
import { rateLimitByIp } from '../../utils/rate-limit'

/**
 * Success-page poll helper.
 * Marks abandoned checkouts as failed.
 * Fulfills only when Polar checkout is succeeded AND amount matches the bid.
 * Preferred fulfillment path remains the order.paid webhook.
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

  if (bid.status !== 'pending' || !bid.polarCheckoutId) {
    return {
      status: bid.status,
      amount: bid.amount,
      gameId: bid.gameId,
      source: 'database'
    }
  }

  try {
    const polar = usePolar()
    const checkout = await polar.checkouts.get({ id: bid.polarCheckoutId })

    if (isCheckoutAbandoned(checkout.status)) {
      await failBid(bidId)
      return {
        status: 'failed',
        amount: bid.amount,
        gameId: bid.gameId,
        source: 'polar_checkout',
        checkoutStatus: checkout.status
      }
    }

    if (!isCheckoutPaid(checkout.status)) {
      return {
        status: bid.status,
        amount: bid.amount,
        gameId: bid.gameId,
        source: 'database',
        checkoutStatus: checkout.status
      }
    }

    const paidAmountCents = paidAmountCentsFromPolar(checkout)
    const result = await fulfillBid(bidId, {
      polarOrderId: `checkout:${bid.polarCheckoutId}`,
      paidAmountCents
    })

    return {
      status: result.fulfilled ? 'paid' : bid.status,
      amount: bid.amount,
      gameId: bid.gameId,
      source: result.fulfilled ? 'polar_checkout' : 'database',
      reason: result.reason
    }
  } catch {
    return {
      status: bid.status,
      amount: bid.amount,
      gameId: bid.gameId,
      source: 'database'
    }
  }
})
