import { sql } from 'drizzle-orm'
import { useDb } from '../../../database/index'
import { games } from '../../../database/schema'
import { getGameBoardPosition } from '../../../utils/board-cache'
import { renderBoardSharePng } from '../../../utils/crown-card'
import { rateLimitByIp } from '../../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  rateLimitByIp(event, { limit: 60, windowMs: 60_000 })

  const rawSlug = getRouterParam(event, 'slug')
  const slug = typeof rawSlug === 'string' ? rawSlug.trim().toLowerCase() : ''

  if (!slug || slug.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid slug' })
  }

  const db = useDb()
  const [game] = await db
    .select({
      id: games.id,
      title: games.title,
      slug: games.slug
    })
    .from(games)
    .where(sql`lower(${games.slug}) = ${slug}`)
    .limit(1)

  if (!game) {
    throw createError({ statusCode: 404, statusMessage: 'Game not found' })
  }

  const board = await getGameBoardPosition(game.id)
  const png = renderBoardSharePng({
    title: game.title,
    totalCents: board.totalCents,
    rank: board.rank,
    kicker: board.rank === 1 ? 'DAILY CROWN' : 'ON THE BOARD',
    dateLabel: new Date().toISOString().slice(0, 10)
  })

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  setHeader(event, 'Content-Disposition', `inline; filename="${game.slug}-board.png"`)

  return png
})
