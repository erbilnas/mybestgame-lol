import { rateLimitByIp } from '../../utils/rate-limit'
import { searchGames } from '../../utils/igdb'

export default defineEventHandler(async (event) => {
  rateLimitByIp(event, { limit: 30, windowMs: 60_000 })

  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const limit = Math.min(Math.max(Number(query.limit ?? 10), 1), 20)

  if (!q) {
    return { games: [] }
  }

  try {
    const games = await searchGames(q, limit)
    return { games }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({ statusCode: 502, statusMessage: 'Game search failed' })
  }
})
