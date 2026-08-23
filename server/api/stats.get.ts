import { getRecentActivity, getSiteStats } from '../utils/bidding'

export default defineEventHandler(async (event) => {
  const [stats, activity] = await Promise.all([
    getSiteStats(),
    getRecentActivity()
  ])

  setResponseHeader(event, 'Cache-Control', 'public, max-age=30, stale-while-revalidate=60')

  return { stats, activity }
})
