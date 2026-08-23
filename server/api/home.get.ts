import { getRecentActivity, getSiteStats } from '../utils/bidding'
import {
  buildTopDirectors,
  getCachedLeaderboardEntries,
  slimLeaderboardEntry
} from '../utils/board-cache'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Math.min(
    Math.max(Number(query.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  )

  const [stats, activity, all] = await Promise.all([
    getSiteStats(),
    getRecentActivity(),
    getCachedLeaderboardEntries()
  ])

  const entries = all.slice(0, limit).map(slimLeaderboardEntry)

  setResponseHeader(event, 'Cache-Control', 'public, max-age=15, stale-while-revalidate=30')

  return {
    stats,
    activity,
    leaderboard: {
      entries,
      total: all.length,
      offset: 0,
      limit,
      hasMore: all.length > limit,
      topDirectors: buildTopDirectors(all).map(slimLeaderboardEntry)
    }
  }
})
