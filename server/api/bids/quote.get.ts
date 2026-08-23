import {
  getFreshLeaderboardTotals,
  getGameTotalCents,
  projectRank,
  validateIncrementCents
} from '../../utils/bidding'
import { rateLimitByIp } from '../../utils/rate-limit'

/** Cap quote amounts to limit DB aggregation abuse ($10,000). */
const MAX_QUOTE_CENTS = 1_000_000

export default defineEventHandler(async (event) => {
  rateLimitByIp(event, { limit: 60, windowMs: 60_000 })

  const query = getQuery(event)
  const gameId = Number(query.gameId)
  const amountDollars = Number(query.amount)

  if (!Number.isInteger(gameId) || gameId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid gameId' })
  }

  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid amount' })
  }

  const incrementCents = Math.round(amountDollars * 100)
  if (incrementCents > MAX_QUOTE_CENTS) {
    throw createError({ statusCode: 400, statusMessage: 'Amount too large' })
  }

  validateIncrementCents(incrementCents)

  const totals = await getFreshLeaderboardTotals()
  const currentTotalCents = await getGameTotalCents(gameId)
  const { projectedRank, projectedTotalCents } = projectRank(totals, gameId, incrementCents)

  return {
    bidType: 'game' as const,
    incrementCents,
    currentTotalCents,
    projectedTotalCents,
    projectedRank: projectedRank || 1
  }
})
