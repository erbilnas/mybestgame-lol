import { and, eq } from 'drizzle-orm'
import { useDb } from '../database/index'
import { bids } from '../database/schema'
import { bidExpiresAt, snapshotGameBoard } from './bidding'
import { invalidateBoardCache } from './board-cache'
import { insertBoardEvent } from './board-events'
import { maskContributor } from './contributor'
import { cancelPolarPaymentForBid } from './polar-cancel'

export function parseMetadataBidId(
  metadata?: Record<string, string | number | boolean> | null
): string | null {
  const bidId = metadata?.bidId
  if (bidId === undefined || bidId === null || bidId === '') {
    return null
  }
  return String(bidId)
}

export async function resolveBidId(options: {
  bidId?: string | null
  checkoutId?: string | null
}): Promise<string | null> {
  const db = useDb()

  if (options.bidId) {
    const [bid] = await db
      .select({ id: bids.id })
      .from(bids)
      .where(eq(bids.id, options.bidId))
      .limit(1)
    return bid?.id ?? null
  }

  if (options.checkoutId) {
    const [bid] = await db
      .select({ id: bids.id })
      .from(bids)
      .where(eq(bids.polarCheckoutId, options.checkoutId))
      .limit(1)
    return bid?.id ?? null
  }

  return null
}

export interface FulfillBidOptions {
  polarOrderId?: string | null
  /** When set, must equal the bid's stored amount (cents). */
  paidAmountCents?: number | null
}

export async function fulfillBid(
  bidId: string,
  polarOrderIdOrOptions?: string | null | FulfillBidOptions
): Promise<{ fulfilled: boolean, reason: string }> {
  const options: FulfillBidOptions = (
    polarOrderIdOrOptions
    && typeof polarOrderIdOrOptions === 'object'
  )
    ? polarOrderIdOrOptions
    : { polarOrderId: polarOrderIdOrOptions as string | null | undefined }

  const polarOrderId = options.polarOrderId ?? null
  const db = useDb()

  const [existing] = await db
    .select({
      id: bids.id,
      status: bids.status,
      gameId: bids.gameId,
      amount: bids.amount,
      displayName: bids.displayName,
      bidType: bids.bidType,
      polarOrderId: bids.polarOrderId,
      polarCheckoutId: bids.polarCheckoutId
    })
    .from(bids)
    .where(eq(bids.id, bidId))
    .limit(1)

  if (!existing) {
    return { fulfilled: false, reason: 'bid not found' }
  }

  if (existing.status === 'paid') {
    return { fulfilled: true, reason: 'already paid' }
  }

  if (existing.status !== 'pending') {
    return { fulfilled: false, reason: `invalid status: ${existing.status}` }
  }

  if (
    options.paidAmountCents !== undefined
    && options.paidAmountCents !== null
    && options.paidAmountCents !== existing.amount
  ) {
    await cancelPolarPaymentForBid({
      polarCheckoutId: existing.polarCheckoutId,
      polarOrderId: polarOrderId ?? existing.polarOrderId
    })

    await db
      .update(bids)
      .set({ status: 'failed' })
      .where(and(eq(bids.id, bidId), eq(bids.status, 'pending')))

    return {
      fulfilled: false,
      reason: `amount mismatch: expected ${existing.amount}, got ${options.paidAmountCents}`
    }
  }

  // Require amount verification for paid Polar fulfillments (not free claims).
  const isFreeOrder = typeof polarOrderId === 'string' && polarOrderId.startsWith('free:')
  if (!isFreeOrder && (options.paidAmountCents === undefined || options.paidAmountCents === null)) {
    return { fulfilled: false, reason: 'paid amount required' }
  }

  if (polarOrderId) {
    const [duplicate] = await db
      .select({ id: bids.id })
      .from(bids)
      .where(eq(bids.polarOrderId, polarOrderId))
      .limit(1)

    if (duplicate && duplicate.id !== bidId) {
      return { fulfilled: false, reason: 'order already used' }
    }
  }

  const before = await snapshotGameBoard(existing.gameId)

  const updated = await db
    .update(bids)
    .set({
      status: 'paid',
      polarOrderId: polarOrderId ?? existing.polarOrderId ?? null,
      expiresAt: bidExpiresAt()
    })
    .where(and(eq(bids.id, bidId), eq(bids.status, 'pending')))
    .returning({ id: bids.id })

  if (updated.length === 0) {
    return { fulfilled: true, reason: 'already paid' }
  }

  const after = await snapshotGameBoard(existing.gameId)
  const contributor = maskContributor(existing.displayName)

  await insertBoardEvent({
    type: 'bid_paid',
    gameId: existing.gameId,
    bidId,
    payload: {
      gameTitle: after.title,
      contributor,
      amountCents: existing.amount,
      rank: after.rank
    }
  })

  const beforeRank = before.rank
  const afterRank = after.rank
  if (afterRank > 0 && (beforeRank === 0 || afterRank < beforeRank)) {
    await insertBoardEvent({
      type: 'rank_takeover',
      gameId: existing.gameId,
      bidId,
      payload: {
        gameTitle: after.title,
        contributor,
        amountCents: existing.amount,
        fromRank: beforeRank || null,
        toRank: afterRank,
        rank: afterRank
      }
    })
  }

  if (existing.bidType === 'sponsor') {
    const beforeSponsorId = before.sponsorBidId
    if (after.sponsorBidId === bidId && beforeSponsorId !== bidId) {
      await insertBoardEvent({
        type: 'sponsor_takeover',
        gameId: existing.gameId,
        bidId,
        payload: {
          gameTitle: after.title,
          contributor,
          amountCents: existing.amount,
          rank: afterRank,
          previousSponsorTitle: before.sponsorTitle,
          sponsorTitle: after.sponsorTitle
        }
      })
    }
  }

  invalidateBoardCache()
  return { fulfilled: true, reason: 'paid' }
}

export async function failBid(
  bidId: string,
  polarOverrides?: {
    polarOrderId?: string | null
    polarCheckoutId?: string | null
  }
): Promise<{ failed: boolean, reason: string, polar?: { cancelled: boolean, reason: string } }> {
  const db = useDb()

  const [existing] = await db
    .select({
      id: bids.id,
      status: bids.status,
      polarCheckoutId: bids.polarCheckoutId,
      polarOrderId: bids.polarOrderId
    })
    .from(bids)
    .where(eq(bids.id, bidId))
    .limit(1)

  if (!existing) {
    return { failed: false, reason: 'bid not found' }
  }

  if (existing.status !== 'pending') {
    return { failed: false, reason: `invalid status: ${existing.status}` }
  }

  const polar = await cancelPolarPaymentForBid({
    polarCheckoutId: polarOverrides?.polarCheckoutId ?? existing.polarCheckoutId,
    polarOrderId: polarOverrides?.polarOrderId ?? existing.polarOrderId
  })

  await db
    .update(bids)
    .set({ status: 'failed' })
    .where(eq(bids.id, bidId))

  return { failed: true, reason: 'failed', polar }
}
