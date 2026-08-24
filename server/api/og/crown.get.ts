import { expireStaleBids } from '../../utils/bidding'
import { getCachedLeaderboardEntries, invalidateBoardCache } from '../../utils/board-cache'
import { renderCrownCardPng } from '../../utils/crown-card'

export default defineEventHandler(async (event) => {
  await expireStaleBids()
  invalidateBoardCache()

  const entries = await getCachedLeaderboardEntries()
  const crown = entries[0]

  if (!crown) {
    throw createError({ statusCode: 404, statusMessage: 'No games on the board' })
  }

  const png = renderCrownCardPng({
    title: crown.title,
    totalCents: crown.totalCents,
    dateLabel: new Date().toISOString().slice(0, 10)
  })

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  setHeader(event, 'Content-Disposition', 'inline; filename="daily-crown.png"')

  return png
})
